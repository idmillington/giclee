(function($) {
    // Import
    var ObjectBase = gce.utils.ObjectBase;

    // --------------------------------------------------------------------
    // The document contains the data to display.
    // --------------------------------------------------------------------

    var Document = ObjectBase.extend();

    /**
     * Creates a new document with the given raw content.
     */
    Document.init = function(content) {
        if (content === undefined) content = [];
        this.content = [
            {type:"foo", pos:{x:100, y:100, o:0.1, s:1.2}},
            {type:"foo", pos:{x:300, y:200, o:0.3, s:0.9}}
        ]; // content;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.document = {
        Document: Document
    };

})(jQuery);