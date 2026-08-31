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
        .attr('y', height * 0.055)
        .attr('dy', -20) // move  up
        .attr('text-anchor', 'middle')
        .text('Väg');

    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', 5)
        .attr('y', height * 0.63)
        .attr('dx', 32)  // move 'gravfält''
        .attr('text-anchor', 'start')
        .text('Gravfält');

    svg.append('text')
        .attr('class', 'venn-label')
        .attr('x', width - 5)
        .attr('y', height * 0.63)
        .attr('dx', -44)  // move 'gräns'
        .attr('text-anchor', 'end')
        .text('Gräns');
}