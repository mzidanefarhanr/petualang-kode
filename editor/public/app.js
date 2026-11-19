/*
 * Host page for the Scratch editor.
 *
 * scratch-gui is consumed as an unmodified dependency and rendered through its
 * public embedding API (`EditorState` + `createStandaloneRoot`). scratch-vm
 * internals are never touched. Classroom integration (top bar, save/intent,
 * read-only window) is added in later steps; for now this only boots the editor
 * and loads the built-in default project so a project can be created and
 * exported as .sb3.
 */
(function () {
    'use strict';

    function boot() {
        var GUI = window.GUI;
        if (!GUI) {
            document.body.textContent = 'Editor gagal dimuat.';
            return;
        }

        var target = document.createElement('div');
        target.id = 'scratch-editor';
        document.body.appendChild(target);

        GUI.setAppElement(target);

        var state = new GUI.EditorState({});
        var gui = GUI.createStandaloneRoot(state, target);

        gui.render({
            canEditTitle: false,
            canSave: false
        });

        // Load the built-in default project on open. ponytail: stands in for
        // HashParserHOC until the classroom API serves the student's project.
        state.dispatch(GUI.setProjectId(GUI.defaultProjectId));

        window.scratchEditor = {gui: gui, state: state};
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
