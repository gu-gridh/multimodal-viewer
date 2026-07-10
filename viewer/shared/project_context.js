try {
    const project = window.parent.document.documentElement.dataset.project;
    if (project) {
        document.documentElement.classList.add(`project-${project}`);
    }
} catch {}
