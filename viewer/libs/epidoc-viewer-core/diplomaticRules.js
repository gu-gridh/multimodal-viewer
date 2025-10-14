import sharedRules from './sharedRules.js'

function isInterveningBreak(currentNode) {
    return (currentNode.nodeType === Node.ELEMENT_NODE
        && ['lb', 'ab', 'cb', 'div'].includes(currentNode.nodeName));
}

function isInterveningText(currentNode) {
    return (currentNode.nodeType === Node.TEXT_NODE && currentNode.nodeValue.trim().length);
}

const removeAllChildNodes = (parent) => {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

const splitAround = (root, splittingElement) => {
    // divide the tree starting at root to the left and right of splittingElement
    // from https://stackoverflow.com/questions/27497718/splitting-node-content-in-javascript-dom
    for (var parent = splittingElement.parentNode; root != parent; parent = grandparent) {
        var right = parent.cloneNode(false);
        while (splittingElement.nextSibling)
            right.appendChild(splittingElement.nextSibling);
        var grandparent = parent.parentNode;
        grandparent.insertBefore(right, parent.nextSibling);
        grandparent.insertBefore(splittingElement, right);
    }
}

const findNextAdjacentSupplied = (tw)=> {
   // let priorNode = tw.currentNode;
    let result = null;
    let done = false;
    while (!done && tw.nextNode()) {
        if (isInterveningText(tw.currentNode) || isInterveningBreak(tw.currentNode)) {
            done = true;    // no adjacent <supplied>, so done
        } else if (tw.currentNode.nodeType === Node.ELEMENT_NODE && ['supplied', 'gap'].includes(tw.currentNode.nodeName)) {
            result = tw.currentNode // we've found another adjacent supplied or gap
            done = true
        }      
    }
   // tw.currentNode = priorNode  // reset treewalker 
    return result;   // return supplied node if any
}

const getTextFromSuppliedAndAdjacentSupplieds = (suppliedNode, tw) => {
    const containedLineBreak = suppliedNode.querySelector('lb')
    if (containedLineBreak) {
        // split the supplied in two and then continue
        splitAround(suppliedNode.parentNode, containedLineBreak)
    }
    let suppliedText = ''
    const reason = suppliedNode.getAttribute('reason');
    if (reason === 'omitted' || reason === 'subaudible') {
        suppliedNode.textContent = ''  // ignore these supplied elements
    } else {
        // remove any supplied expansions of abbreviations
        suppliedNode.querySelectorAll('ex').forEach(exNode=>exNode.textContent = '')
        if (suppliedNode.nodeName === 'supplied') {
            suppliedText = suppliedNode.textContent.trim()
        } else if (suppliedNode.nodeName === 'gap') {
            let quantity = suppliedNode.getAttribute('quantity');
            if (quantity && ! isNaN(quantity)) {
                suppliedText = 'X'.repeat(parseInt(quantity))
            }
        }
        removeAllChildNodes(suppliedNode)
        let adjacentSupplied = findNextAdjacentSupplied(tw);  // see if there is an adjacent supplied
        if (adjacentSupplied) {
            suppliedText = suppliedText + getTextFromSuppliedAndAdjacentSupplieds(adjacentSupplied, tw);
            adjacentSupplied.parentNode.removeChild(adjacentSupplied) 
            //adjacentSupplied.textContent = ''
        } 
    }
    return suppliedText
}

const diplomaticRules = {
    'supplied': (node, tw) => {
        
        const finalText = getTextFromSuppliedAndAdjacentSupplieds(node, tw)
        if (! finalText) {
            node.textContent = ''
        } else if (finalText.length < 5) {
                node.textContent = `[ ${'.'.repeat(finalText.length)}]`
        } else {
            node.textContent = `[.. ${finalText.length} ..]`
        } 
        tw.currentNode = node;  // reset treewalker
    },
   // 'unclear': node => node.textContent = '',
   // 'gap': node => node.textContent = '',
    'desc': node => node.textContent = '',
    'note': node => node.textContent = '',
    'ex': node => node.textContent = '',
    ...sharedRules(false)
}

export default diplomaticRules