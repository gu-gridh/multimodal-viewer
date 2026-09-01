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

function addVennLabels(svg, width, height) {
    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', width * 0.50)
        .attr('y', height * 0.02)
        .attr('text-anchor', 'middle')
        .text('Väg');

    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', width * 0.09)
        .attr('y', height * 0.63)
        .attr('text-anchor', 'middle')
        .text('Gravfält');

    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', width * 0.90)
        .attr('y', height * 0.63)
        .attr('text-anchor', 'middle')
        .text('Gräns');
}