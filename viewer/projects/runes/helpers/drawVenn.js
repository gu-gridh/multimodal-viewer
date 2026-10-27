//get wanted circle size
function getCircleGeometry(width, height) {
    const radius = Math.min(width, height) * 0.30; //change to get smaller/bigger circles
        return {
            'Väg': {
                x: width * 0.50,
                y: height * 0.34,
                r: radius
            },

            'Grav': {
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
    const graveField = circles['Grav'];
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

// statistics legend
function updateVennStatistics(stones) {
    const container = document.getElementById('venn-statistics');

    const allStones = [
        ...stones.venn,
        ...stones.outside
    ];

    // Avoid duplicate IDs
    const uniqueStones = [
        ...new Map(
            allStones.map(stone => [stone.id, stone])
        ).values()
    ];

    const total = uniqueStones.length;

    if (!total) {
        container.innerHTML = '';
        return;
    }

    const categories = [
        { name: 'Endast väg', sets: ['Väg'] },
        { name: 'Endast gravfält', sets: ['Grav'] },
        { name: 'Endast gräns', sets: ['Gräns'] },
        { name: 'Väg + gravfält', sets: ['Väg', 'Grav'] },
        { name: 'Väg + gräns', sets: ['Väg', 'Gräns'] },
        { name: 'Gravfält + gräns', sets: ['Grav', 'Gräns'] },
        { name: 'Alla tre', sets: ['Väg', 'Grav', 'Gräns'] },
        { name: 'Utanför', sets: [] }
    ];

    const statistics = categories.map(category => {
        const count = uniqueStones.filter(stone => {
            const sets = stone.sets || [];

            return (
                sets.length === category.sets.length &&
                category.sets.every(set => sets.includes(set))
            );
        }).length;

        return {
            name: category.name,
            count,
            percent: Math.round((count / total) * 100),
        };
    });

    container.innerHTML = `
        <!--<div class="statistics-title">
            Runstenarnas placering
        </div> -->

        <div class="statistics-total">
            ${total} runstenar · Period ${activePeriod}
        </div>

        ${statistics.map(stat => `
            <div class="statistics-row">
                <span>${stat.name}</span>
                <span>${stat.percent} %</span>
            </div>
        `).join('')}
    `;
}