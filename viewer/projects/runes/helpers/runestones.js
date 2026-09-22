function clearSelectedRunestone() {
    // Remove q from URL
    const url = new URL(window.location.href);

    url.searchParams.delete('q');

    window.history.pushState(
        {},
        '',
        url.pathname
    );

    // Restore colors in the Venn diagram
    d3.selectAll('.runestone').each(function () {
        const group = d3.select(this);

        const isPeriod3 =
            group.attr('data-period3') === 'true';

        group.select('rect')
            .attr(
                'fill',
                isPeriod3
                    ? '#999'
                    : '#ffc76a'
            );
    });

    // Reset right viewer to empty metadata page
    activeViewer = 'metadata';

    const iframe =
        document.getElementById('right-iframe');

    iframe.src =
        '/viewer/projects/runes/metadata/metadata.html';

    moduleSwitcherRight();
}