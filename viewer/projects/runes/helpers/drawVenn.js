        //get wanted circle size
function getCircleGeometry(width, height) {
    const radius = Math.min(width, height) * 0.30; //change to get smaller/bigger circles
        return {
            'Väg': {
                x: width * 0.50,
                y: height * 0.34,
                r: radius
            },

            'Gravfält': {
                x: width * 0.38,
                y: height * 0.60,
                r: radius
            },

            'Gräns': {
                x: width * 0.62,
                y: height * 0.60,
                r: radius
            }
        };
}


function drawCircles(svg, circles) {
    Object.entries(circles).forEach(([name, circle]) => {
        svg.append('circle')
            .attr('cx', circle.x)
            .attr('cy', circle.y)
            .attr('r', circle.r)
            .attr('fill', 'none')
            .attr('stroke', '#999')
            .attr('stroke-width', 2);
    });
}

function addVennLabels(svg, circles) {
    const offset = 10 //distance to circles
    const road = circles['Väg'];
    const graveField = circles['Gravfält'];
    const border = circles['Gräns'];
    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', road.x)
        .attr('y', road.y - road.r - offset)
        .attr('text-anchor', 'middle')
        .text('Väg');

    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', graveField.x - graveField.r - offset - 20)
        .attr('y', graveField.y)
        .attr('text-anchor', 'middle')
        .text('Gravfält');

    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', border.x + border.r + offset + 15)
        .attr('y', border.y)
        .attr('text-anchor', 'middle')
        .text('Gräns');
}