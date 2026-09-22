function clearSelectedRunestone() {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            window.history.pushState(
                {},
                '',
                url.pathname
            );
            //hide the navigation bar
            document.getElementById('nav-bar').style.display = 'none';

            // Restore stone colors
            d3.selectAll('.runestone').each(function () {
                const group = d3.select(this);
                const isPeriod3 = group.attr('data-period3') === 'true';
                group.select('rect')
                    .attr(
                        'fill',
                        isPeriod3
                            ? STONE_COLORS.period3
                            : STONE_COLORS.normal
                    );
            });
            // Show empty metadata state
            activeViewer = 'metadata';
            const iframe = document.getElementById('right-iframe');
            iframe.src = '/viewer/projects/runes/metadata/metadata.html'
            moduleSwitcherRight();
        }