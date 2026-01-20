const sharedRules = (isInterpreted) => {
    return {
        'div': node => {
            const type = node.getAttribute('type')
            const subtype = node.getAttribute('subtype')
            const n = node.getAttribute('n')
            if (type === 'textpart') {
                const title = document.createElement('span')
                title.className += ' section-heading';
                title.append(`${subtype} ${n}`)
                node.prepend(title)
            } else if (type === 'edition' && subtype === 'transliteration') {
                const title = document.createElement('span')
                title.className += ' section-heading';
                title.append(`Transliteration`)
                node.prepend(title)
            }
        },
        'ab': node => {
            const span = document.createElement('span')
            span.className += ' leiden-transcription';
            [...node.childNodes].forEach(child => span.appendChild(child));
            node.appendChild(span)
        },
        'milestone': node => {
            const sup = document.createElement('sup')
            sup.textContent = `${node.getAttribute('n')}`
            node.append('|')
            node.append(sup)
        },
        'cb': node => {
            const title = document.createElement('span')
            title.className += ' section-heading';
            title.append(`Col. ${node.getAttribute('n')}`)
            node.prepend(title)
        }, 
        'lb': node => {
            const breakAttr = node.getAttribute('break');
            const n = node.getAttribute('n')
            const style = node.getAttribute('style')
            let textIndicator = ' '
            if (style === "text-direction:r-to-l") {
                textIndicator = '←'
            } else if (style === "text-direction:l-to-r") {
                textIndicator = '→'
            } else if (style === "text-direction:spiral-clockwise") {
                textIndicator = '↻'
            } else if (style === "text-direction:circular-clockwise") {
                textIndicator = '↻'
            } else if (style === "text-direction:spiral-anticlockwise") {
                textIndicator = '↺'
            } else if (style === "text-direction:circular-anticlockwise") {
                textIndicator = '↺'
            } else if (style === "text-direction:upwards") {
                textIndicator = '↑'
            } else if (style === "text-direction:downwards") {
                textIndicator = '↓'
            } 
            if (breakAttr === 'no' && isInterpreted) node.append('-');
            if (n !== 1) node.append(document.createElement('br'));
            const numSpan = document.createElement('span')
            numSpan.className += ' leiden-num-span'
            numSpan.append(`${n}. ${textIndicator}`)
            node.append(numSpan)
        },
        'space': node => {
            const extent = node.getAttribute('extent');  
            const unit = node.getAttribute('unit');  // character or line
            const isUncertain = node.getAttribute('cert') === 'low'
            const quantity = node.getAttribute('quantity'); 
            let textContent = '('
            if (unit === 'line') {
                textContent += 'vacat'
            } else {
                if (quantity || (extent === 'unknown' && isUncertain)) {
                    textContent += 'vac.'
                    if (quantity > 1) textContent += quantity
                    if (isUncertain) textContent += '?'   
                } else if (extent === 'unknown') {
                    textContent += 'vacat'
                } 
            }
            textContent += ')'
            node.textContent = textContent
        },
        'gap': node => {
            let elementText;
            const reason = node.getAttribute('reason');  // 'lost' 'illegible' 'omitted'
            const extent = node.getAttribute('extent');  // always 'unknown' if present?  - never in combination with quantity or atLeast/atMost
            const quantity = node.getAttribute('quantity'); // not in combination with extent or atLeast/atMost
            const unit = node.getAttribute('unit');  // character, line, or some other unit like cm
            const atLeast = node.getAttribute('atLeast');  // not in combination with extent or quantity
            const atMost = node.getAttribute('atMost');     // not in combination with extent or quantity
            const precision = node.getAttribute('precision');  // 'low' output: ca. 
            const precisionOutput = precision && precision === 'low' ? 'ca.' : '' ;
            const isLine = (unit && unit === 'line');
            let closingDelimiter = ''
            if (reason === 'lost') {
                if (isLine) {
                    if (extent==='unknown') {
                        elementText =  ' - - - - - ' 
                    } else {
                        elementText = '  [- - - - - -';
                        closingDelimiter = ']  '
                    }
                } else {
                    // Dots are used only when exact number of characters is known.
                    // Dashes otherwise.
                    elementText = '[';
                    if (extent === 'unknown') {
                        elementText += '- - ? - -';
                    } else if (atLeast || atMost) {
                        elementText += ` - ${atLeast}-${atMost} - `
                    } else if (quantity && quantity < 5) {
                        elementText += '. '.repeat(quantity).trim();
                    } else if (quantity && quantity >= 5) {
                        if (precision === 'low' || (unit !== 'character' && unit !== 'line')) {
                            // note that we display the unit if it isn't 'character' or 'line' because it is likely 'cm'
                            elementText += `- - ${precisionOutput}${quantity}${(unit !== 'character' && unit !== 'line')?unit:''} - - `
                        } else {
                            elementText += `. . ${quantity} . . `
                        } 
                    }
                    closingDelimiter = ']';
                }
            } else if (reason === 'illegible') {
                const beforeText = isLine ? '(Traces of ' : '. . '
                const afterText = isLine ? ' lines)' : ' . .'
                if (extent === 'unknown') {
                    elementText = isLine ?
                    `${beforeText.trim()}${afterText}` :
                    `${beforeText}?${afterText}`
                } else if (atLeast || atMost) {
                    elementText = `${beforeText}${atLeast}-${atMost}${afterText}`
                } else if (quantity && quantity < 5) {
                    elementText = '. '.repeat(quantity).trim();
                } else if (quantity && quantity >= 5) {
                    elementText = `${beforeText}${precisionOutput}${quantity}${afterText}`
                }
            } else if (reason === 'omitted') {
                elementText = '<- - ? - ';
                closingDelimiter = '->'
            }
            node.prepend(elementText);
            node.append(closingDelimiter)
        },'unclear': (node) => {
            //&#x30A; is equivalent to U+030A and \u030A
            const combiningChar = isLatinSpecifiedInAncestor(node)?'\u030A':'\u0323'
            node.textContent = node.textContent.split('').map(character => character + combiningChar).join('').trim();
        }
    }
}

const isLatinSpecifiedInAncestor = (node) => {
    if (! node) {
        return false
    } else if (node.getAttribute('xml:lang') === 'xpu-Latn') {
        return true
    }  else {
        return isLatinSpecifiedInAncestor(node.parentNode);
    }
}

export default sharedRules