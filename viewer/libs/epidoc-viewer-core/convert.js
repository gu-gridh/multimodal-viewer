import './addCSS.js';
import rules from './rules.js'
import diplomaticRules from './diplomaticRules.js'

const parser = new DOMParser();

function normalizeText(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
}

function isBreak(node) {
    return (node.nodeType === Node.ELEMENT_NODE
        && ['lb', 'ab', 'cb', 'div'].includes(node.nodeName));
}

const convert = (tei, openPopup, showInterpreted, overridingRules) => { 
    // openPopup takes two args:  title, body
    let fixedTEI = tei.replace(/[\r\n\t]/g, "")
    const showDiplomatic = ! showInterpreted
    if (showDiplomatic) {
        fixedTEI = normalizeText(fixedTEI)
    }

    const parent = document.createElement('div')
    parser.
        parseFromString(fixedTEI, "application/xml").
        querySelectorAll('div[type="edition"]').
        forEach(node=>parent.appendChild(node))
    
   // parser.preserveWhitespace=true;
    
    const tw = document.createTreeWalker(parent);

    // choose interpreted or diplomatic rules
    const rulesToApply = {...(showInterpreted?rules:diplomaticRules), ...overridingRules}
    
    while (tw.nextNode()) {
        
        if (tw.currentNode.nodeType === Node.TEXT_NODE && 
            showDiplomatic && 
            ! ['note', 'desc', 'gap'].includes(tw.currentNode.parentNode.nodeName)) {
                tw.currentNode.nodeValue = tw.currentNode.nodeValue.toUpperCase()
        }
        const rule = rulesToApply[tw.currentNode.nodeName]
        if (rule) rule(tw.currentNode, tw, openPopup)

    }

    // second pass to remove adjacent brackets that should be elided
    // start by setting treewalker back to root
    tw.currentNode = parent
    let nextBracketToMatch = null
    let nodeWithLastBracketMatched = null
    while (tw.nextNode())  {
        if (tw.currentNode.nodeType === Node.TEXT_NODE && tw.currentNode.nodeValue.trim()) {
            if (nextBracketToMatch) {
                if (tw.currentNode.nodeValue.trim().startsWith(nextBracketToMatch)) {
                    // found two adjacent brackets , e.g., ][ or )( or ><
                    // so remove both brackets
                    nodeWithLastBracketMatched.nodeValue = nodeWithLastBracketMatched.nodeValue.trim().slice(0, -1)
                    tw.currentNode.nodeValue = tw.currentNode.nodeValue.trim().slice(1)
                } else {
                    // something else was in the text node besides the bracket we were looking for so
                    // clear our matches
                    nextBracketToMatch = null
                    nodeWithLastBracketMatched = null
                }
            } else if (tw.currentNode.nodeValue.trim().endsWith(']')) {
                nextBracketToMatch = '['
                nodeWithLastBracketMatched = tw.currentNode
            } else if (tw.currentNode.nodeValue.trim().endsWith(')')) {
                nextBracketToMatch = '('
                nodeWithLastBracketMatched = tw.currentNode
            } else if (tw.currentNode.nodeValue.trim().endsWith('>')) {
                nextBracketToMatch = '<'
                nodeWithLastBracketMatched = tw.currentNode
            }
        } 
    }

    return parent
}

export default convert