(function() {
    // Import
    var ObjectBase = giclee.utils.ObjectBase;

    // --------------------------------------------------------------------
    // A Command Handler can execute commands on a document.
    // --------------------------------------------------------------------

    var CommandHandler = ObjectBase.extend();

    /**
     * Assume we're created with no document, because the document
     * also needs to be told about the handler, and we'll assume the
     * document will register itself with us.
     */
    CommandHandler.init = function() {
        this.document = null;
    };

    /**
     * Documents call this to register themselves with this
     * handler. It should be overridden in handlers that need to build
     * some acceleration data structures over the document.
     */
    CommandHandler.setDocument = function(document) {
        this.document = document;
    };

    /**
     * Executes a command on the attached document, returns the event
     * showing what changed.
     */
    CommandHandler.execute = function(command) {
        return command.execute(this.document);
    };

    // Command handlers that send out events when something changes.
    // --------------------------------------------------------------------

    EventGeneratingCommandHandler = CommandHandler.extend();

    /**
     * A command handler that keeps a list of listeners, and will
     * notify them with an event when the handler issues a change to
     * the document.
     */
    EventGeneratingCommandHandler.init = function() {
        CommandHandler.init();
        this.listeners = [];
    };

    /**
     * Run the given command, then fire the event returned.
     */
    EventGeneratingCommandHandler.execute = function(command) {
        var event = CommandHandler.execute(command);
        this._sendEvent(event);
        return event;
    };

    /**
     * Sends the given event to all listeners.
     */
    EventGeneratingCommandHandler._sendEvent = function(event) {
        // Send it after the thread next yields, to batch changes
        // together.
        var that = this;
        if (that._sending === undefined) {
            that._sending = setTimeout(function() {
                for (var i = 0; i < that.listeners.length; i++) {
                    that.listeners[i](event);
                }
                delete that._sending;
            }, 0);
        }
    };

    /**
     * Adds the given callback function as a listener to this handler.
     */
    EventGeneratingCommandHandler.addListener = function(listener) {
        this.listeners.push(listener);
    };

    /**
     * Removes the given callback from the list of listeners.
     */
    EventGeneratingCommandHandler.removeListener = function(listener) {
        for (var i = this.listeners.length-1; i >= 0; --i) {
            if (this.listeners[i] == listener) {
                this.listeners.splice(i, 1);
            }
        }
    };

    // --------------------------------------------------------------------
    // The document links the data to display with a command
    // handler. The data is just an arbitrary javascript object, which
    // is passed to a ModelFactory to create something that can be
    // rendered.
    // --------------------------------------------------------------------

    var Document = ObjectBase.extend();

    /**
     * Creates a new document with the given raw content.
     */
    Document.init = function(content) {
        if (content === undefined) content = {};
        this.content = content;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.document = {
        CommandHandler: CommandHandler,
        EventGeneratingCommandHandler: EventGeneratingCommandHandler,

        Document: Document
    };

})();