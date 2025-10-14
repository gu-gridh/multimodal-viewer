import sharedRules from './sharedRules.js'

const getDescendants = (node, accum) => {
    accum = accum || [];
    [...node.childNodes].forEach(child => {
        accum.push(child)
        getDescendants(child, accum);
    });
    return accum
}

const addSingleSpaceSpan = (node) => {
    const whitespaceElem = document.createElement('span')
    whitespaceElem.className += ' single-space-holder';
    node.appendChild(whitespaceElem)
}

function underline(node) {
    const underlineSpan = document.createElement('span');
    underlineSpan.className = 'underline';
    [...node.childNodes].forEach(child => underlineSpan.appendChild(child));
    node.appendChild(underlineSpan);
}

function addOpeningBracket(reason, node) {
    if (reason === 'lost') {
        node.prepend('[');
    } else if (reason === 'omitted') {
        node.prepend('<');
    } else if (reason === 'subaudible') {
        node.prepend('(scil. ');
    }
}

function addClosingBracket(reason, node) {
    if (reason === 'lost') {
        node.append(']');
    } else if (reason === 'omitted') {
        node.append('>');
    } else if (reason === 'subaudible') {
        node.append(')');
    }
}

/* 
    when we hit a supplied, prepend a square bracket, and then start looking for an adjacent supplied.
    As soon as we hit a text node with actual text, stop, and append a bracket to the last supplied we found.
    If we hit another supplied, then start looking for another.

    */
const mergeAdjacentSupplied = (node, tw) => {
    const isUncertain = node.getAttribute('cert') === 'low'
    const reason = node.getAttribute('reason')
    let lastVisitedSupplied = node;
    addOpeningBracket(reason, node);
    if (isUncertain) node.append('(?)')
    let descendants = getDescendants( node )
    let currentNode = tw.nextNode()
    while(currentNode) {
         if (descendants.includes(currentNode)) {
            // skip all descendants of 'supplied'
            // POSSIBLE TODO:  check for breaks (lb ab cb) in descendants, and if there, add an
            // opening bracket before, and a closing bracket after.
            currentNode = tw.nextNode()
        } else if (isInterveningText(currentNode) ||
                isBreak(currentNode) ||
                isNotElidableSupplied(currentNode, reason)) {
                    currentNode = null    // we are done
        } else if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.nodeName === 'supplied') {
            // we've found another adjacent supplied
            lastVisitedSupplied = currentNode;
            if (currentNode.getAttribute('cert') === "low") currentNode.append('(?)')
            currentNode.setAttribute('leiden-processed', 'true')  // this is so we don't apply our rule to this 'supplied' later
            descendants = getDescendants(currentNode) // now ignore the descendants of this 'supplied' node 
            currentNode = tw.nextNode()  
        } else {
            // skip over any other nodes, e.g, empty text nodes, other elements, etc.
            currentNode = tw.nextNode()
        }         
    }
    // need to append the end bracket here if we've reached the end of the elements, 
    // without having hit a text node earlier
    addClosingBracket(reason, lastVisitedSupplied); 
    // reset tree walker back to original node
    tw.currentNode = node
}

function isNotElidableSupplied(currentNode, firstReason) {
    return currentNode.nodeType === Node.ELEMENT_NODE
        && currentNode.nodeName === 'supplied'
        && ( (currentNode.getAttribute('reason') !== firstReason) || 
        (currentNode.getAttribute('evidence') === 'previouseditor'))
}

function isBreak(currentNode) {
    return (currentNode.nodeType === Node.ELEMENT_NODE
        && ['lb', 'ab', 'cb', 'div'].includes(currentNode.nodeName));
}

function isInterveningText(currentNode) {
    return (currentNode.nodeType === Node.TEXT_NODE && currentNode.nodeValue.trim().length);
}

function processHi(node) {
    const rend = node.getAttribute('rend');
    if (rend === 'ligature') {
        // add circumflex over every character except last
        node.textContent = node.textContent.split('').join('\u0302')
    } else if (rend === "apex") {
        const oldText = node.textContent;
        node.textContent = oldText.charAt(0) + '\u0301' + oldText.substring(1)
    } else if (rend === "reversed") {
        node.prepend('((')
        node.append('))')
    } else if (rend === "intraline") {
        const strikethrough = document.createElement('span');
        strikethrough.textContent = node.textContent;
        strikethrough.className += ' strikethrough'
        node.textContent = '';
        node.appendChild(strikethrough);
        /* const strikethrough = document.createElement('s');
        strikethrough.textContent = node.textContent;
        node.textContent = '';
        node.appendChild(strikethrough); */
    } else if (rend === "supraline") {
        const supraline = document.createElement('span');
        supraline.textContent = node.textContent;
        supraline.className += ' supraline'
        node.textContent = '';
        node.appendChild(supraline);
    } else if (rend === "underline") {
        const underline = document.createElement('span');
        underline.textContent = node.textContent;
        underline.className += ' underline'
        node.textContent = '';
        node.appendChild(underline);
    } else if (rend === "superscript") {
        const sup = document.createElement('sup');
        sup.textContent = node.textContent;
        node.textContent = '';
        node.appendChild(sup);
    }

}

const hyperlinkNode = node => {
    const ref = node.getAttribute('ref');
    if (ref) {
        const a = document.createElement('a')
        const href = document.createAttribute('href')
        href.value = ref
        a.setAttributeNode(href);
        [...node.childNodes].forEach(child => a.appendChild(child));
        node.appendChild(a)
    }
}

const makePopupable = (node, popupText, openPopup) => {
    const sup = document.createElement('sup')
    // lighter arrow: \u2197   darker arrow: \u2B08
    sup.append('⦗\u2197⦘')
    const span = document.createElement('span')
    span.addEventListener("click", ()=>openPopup(popupText));
    // copy the nodes children to the new span
    [...node.childNodes].forEach(child => span.appendChild(child));
    span.appendChild(sup)
    node.appendChild(span)
}

const appendSpaceToNode = (node, tw) => {
    /****  IMPORTANT: textContent removes all children and sets text of this node to a concatentation of children's text */
    node.textContent = node.textContent + ' ';
}


const rules = {
    'w': node => {
        if (node.getAttribute('part') === 'I') {
            const exChild = node.querySelector('ex')
            if (exChild) {
                exChild.append('-')
            }
        } 
    },
    'ex': node => {
        const cert = node.getAttribute('cert')
        node.prepend('('); 
        if (cert === 'low') node.append('?')
        node.append(')')
    },
    'abbr': node => {
        if (node.parentNode.nodeName !== 'expan') node.append('(- - -)')
    },
    'am': node => {
        node.textContent = ''
    },
    'del': (node) => {
        const rend = node.getAttribute('rend');
        if (rend ==="erasure") {
            node.prepend('⟦'); node.append('⟧')
        } 
    },
    'handShift': (node) => {
        const newAttribute = node.getAttribute('new');
        const n = newAttribute.lastIndexOf('h');
        let handNumber = ''
        if (n) {
            let number = newAttribute.substring(n + 1);
            if (number) {
                handNumber = ' ' + number
            }
        }
        node.textContent = `((hand${handNumber}))`
    },
    'subst': (node, tw, openPopup ) => {
        const del = node.querySelector('del')
         if (del) {
             const rend = del.getAttribute('rend')
             if (rend === 'corrected') {
                const popupText = `Deleted: ${del.textContent}`
                del.parentNode.removeChild(del);  
                makePopupable(node, popupText, openPopup)
             }
        }
    },
    'num': (node, tw, openPopup ) => {
        const value = node.getAttribute('value')
        const atLeast = node.getAttribute('atLeast')
        const atMost = node.getAttribute('atMost')
        let popupText;
        if (value) {
            popupText = value
        } else if (atLeast && atMost) {
            popupText = `${atLeast}-${atMost}`
        }
        if (popupText) {
            makePopupable(node, popupText, openPopup)
        }
    },
    'add': node => {
        const place = node.getAttribute('place');
        if (place === 'overstrike') {
            node.prepend('«')
            node.append('»')
        } else if (place === 'above') {
            node.prepend('`') 
            node.append('´')
        }
    },
    'surplus': node => {
        node.prepend('{')
        node.append('}')
    },
    'desc': node => {
        node.prepend('(')
        node.append(')')
    },
    'note': node => {
        node.prepend('(')
        node.append(')')
    },
    'g': appendSpaceToNode,
   // 'name': appendSpaceToNode,
    'placename': hyperlinkNode,
    'persname': hyperlinkNode,
    'supplied': (node, tw) => {
        // ignore 'supplied' that we merged into a prior 'supplied'
        if (node.getAttribute('leiden-processed') === 'true') return null
        if (node.getAttribute('evidence') === 'previouseditor') {
            // simply underline if previouseditor, no square brackets
            underline(node)
        } else {
            mergeAdjacentSupplied(node, tw)
        }
    },
    'hi': node => {

        processHi(node);
    },
    'choice': (node, tw, openPopup ) => {
        const reg = node.querySelector('reg')
        const corr = node.querySelector('corr')
        if (reg) {
            const popupText = `Regularized: ${reg.textContent}`
            reg.parentNode.removeChild(reg);  
            makePopupable(node, popupText, openPopup)
        } else if (corr) {
            const popupText = `Corrected: ${corr.textContent}`
            corr.parentNode.removeChild(corr);  
            makePopupable(node, popupText, openPopup)
        }
    },
    ...sharedRules(true)
}

export default rules


