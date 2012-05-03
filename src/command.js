(function() {
    // Import
    var ObjectBase = giclee.utils.ObjectBase;

    // --------------------------------------------------------------------
    // Commands wrap modifications to a document.
    // --------------------------------------------------------------------

    var CommandBase = ObjectBase.extend();

    /**
     * Creates a new command with the given options. This base class
     * is not normally instantiated, and the options are sub-class
     * dependent.
     */
    CommandBase.init = function(commandOptions) {
        this.options = commandOptions;
    };

    /**
     * Runs this command on the given document. As part of this, the
     * command should store enough information to be undone with the
     * undo() method. Execute is guaranteed to be called before
     * undo. Returns an event encapsulating what changed, or null if
     * nothing changed.
     */
    CommandBase.execute = function(document) {
        return null;
    };

    /**
     * Undoes the command on the given document. The command can
     * assume it was the last thing to do be executed on the
     * document. As part of this method, the command should store
     * enough information to be redone with the redo() method. Undo is
     * guaranteed to be called before redo(). Returns an event
     * encapsulating what changed, or null if nothing changed.
     */
    CommandBase.undo = function(document) {
        return null;
    };

    /**
     * Redoes the command after a previous undo. Returns an event
     * encapsulating what changed, or null if nothing changed.
     */
    CommandBase.redo = function(document) {
        return null;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.command = {
        CommandBase: CommandBase
    };

})();