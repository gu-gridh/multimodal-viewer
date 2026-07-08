try {
    document.documentElement.classList.toggle(
        'has-parent-back-button',
        window.parent !== window &&
        Boolean(window.parent.document.querySelector('a[href] .back-button, a[href] #back-button'))
    );
} catch {}
