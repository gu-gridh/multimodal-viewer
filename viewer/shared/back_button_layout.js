try {
    document.documentElement.classList.toggle(
        'has-parent-back-button',
        window.parent !== window &&
        Boolean(window.parent.document.querySelector('a[href] .back-button, a[href] #back-button'))
    );
    const menu = window.parent !== window && window.parent.document.querySelector('.ui-module');
    const updateMenuLayout = () => document.documentElement.classList.toggle(
        'has-parent-ui-module', Boolean(menu && window.parent.getComputedStyle(menu).display !== 'none')
    );
    updateMenuLayout();
    window.addEventListener('resize', updateMenuLayout);
} catch { }
