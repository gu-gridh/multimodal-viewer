try {
    document.documentElement.classList.toggle(
        'has-parent-back-button',
        window.parent !== window && Boolean(window.parent.document.querySelector('.back-button, #back-button'))
    );
} catch {}
