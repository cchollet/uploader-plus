SoftwareLoop.FlashUploadPlus = function (htmlId) {
    SoftwareLoop.FlashUploadPlus.superclass.constructor.call(this, htmlId);
    return this;
};

YAHOO.extend(SoftwareLoop.FlashUploadPlus, Alfresco.FlashUpload, {

    allowedContentTypesDestinationTemplate: Alfresco.constants.PROXY_URI +
        "uploader-plus/allowed-content-types?destination={destination}",

    allowedContentTypesSiteTemplate: Alfresco.constants.PROXY_URI +
        "/uploader-plus/allowed-content-types?siteid={siteId}&containerid={containerId}&path={uploadDirectory}",

    allowedContentTypesBlankUrl: Alfresco.constants.PROXY_URI +
        "/uploader-plus/allowed-content-types",

    show: function (config) {
        console.debug("show");
        SoftwareLoop.FlashUploadPlus.superclass.show.call(this, config);

        if (!this.types && (this.showConfig.mode !== this.MODE_SINGLE_UPDATE)) {
            this.loadTypes();
        }
    },

    loadTypes: function () {
        console.debug("loadTypes");
        var url;
        if (this.showConfig.destination) {
            url = YAHOO.lang.substitute(
                this.allowedContentTypesDestinationTemplate,
                {
                    destination: encodeURIComponent(this.showConfig.destination)
                }
            );
        } else if (this.showConfig.siteId) {
            url = YAHOO.lang.substitute(
                this.allowedContentTypesSiteTemplate,
                {
                    siteId: encodeURIComponent(this.showConfig.siteId),
                    containerId: encodeURIComponent(this.showConfig.containerId),
                    uploadDirectory: encodeURIComponent(this.showConfig.uploadDirectory)
                }
            );
        } else {
            url = this.allowedContentTypesBlankUrl;
        }

        Alfresco.util.Ajax.jsonGet({
            url: url,
            responseContentType: Alfresco.util.Ajax.JSON,
            successCallback: {
                fn: function (response) {
                    this.types = response.json.types;
                    this.populateSelect();
                },
                scope: this
            },
            failureCallback: {
                fn: function (response) {
                    console.log(response);
                },
                scope: this
            }
        });
    },

    populateSelect: function () {
        console.debug("populateSelect");
        var contentTypeSelectId = this.id + "-content-type-select";
        this.contentTypeSelectNode = YAHOO.util.Dom.get(contentTypeSelectId);
        this.contentTypeSelectNode.innerHTML = "";
        for (var i = 0; i < this.types.length; i++) {
            var current = this.types[i];
            var option = new Option(current, current, i === 0);
            this.contentTypeSelectNode.add(option);
        }
        YAHOO.util.Event.addListener(
            this.contentTypeSelectNode,
            "change",
            this.onContentTypeChange,
            this,
            true
        );
    },

    onContentTypeChange: function () {
        console.debug("onContentTypeChange");
        var contentType = this.contentTypeSelectNode.value;
        var formHtmlId = this.id + "-metadata-form";
        var url = YAHOO.lang.substitute(
            "{serviceContext}components/form?itemKind=type&itemId={itemId}&mode=create&submitType=json&formId={formId}&showCancelButton=true&htmlid={htmlid}",
            {
                serviceContext: Alfresco.constants.URL_SERVICECONTEXT,
                itemId: contentType,
                formId: "upload-folder",
                htmlid: formHtmlId
            }
        );

        Alfresco.util.Ajax.request({
            url: url,
            responseContentType: "html",
            execScripts: true,
            successCallback: {
                fn: this.onMetadataFormReceived,
                scope: this
            },
            failureCallback: {
                fn: function (response) {
                    console.log(response);
                },
                scope: this
            }
        });
    },

    onMetadataFormReceived: function (response) {
        console.debug("onMetadataFormReceived");
        var formHtmlId = this.id + "-metadata-form";
        var formNode = YAHOO.util.Dom.get(formHtmlId);
        formNode.innerHTML =
            response.serverResponse.responseText;
        var currentRecord = this.records[this.currentRecordIndex];
        var data = currentRecord.getData();
        var cmNameId = this.id + "-metadata-form_prop_cm_name";
        var cmNameNode = YAHOO.util.Dom.get(cmNameId);
        if (cmNameNode) {
            cmNameNode.value = data.name;
            cmNameNode.readOnly = true;
        }

        this.formUi = Alfresco.util.ComponentManager.find({
            id: this.id + "-metadata-form-form",
            name: "Alfresco.FormUI"
        })[0];
        var oldOnReady = this.formUi.onReady;
        this.formUi.onReady = SoftwareLoop.hitch(this, function () {
            oldOnReady.apply(this.formUi, arguments);
            this.formUiFixButtons();
        });
    },

    formUiFixButtons: function () {
        console.debug("formUiFixButtons");
        var submitButton = this.formUi.buttons.submit;
        submitButton.removeListener("click");
        submitButton.addListener(
            "click",
            this.onMetadataSubmit,
            this,
            this
        );
        if (this.currentRecordIndex === this.records.length - 1) {
            submitButton.set("label", "Ok")
        } else {
            submitButton.set("label", "Next")
        }
        var cancelButton = this.formUi.buttons.cancel;
        cancelButton.removeListener("click");
        cancelButton.addListener(
            "click",
            this.onMetadataCancel,
            this,
            this
        );
    },

    processMetadata: function () {
        var contentType = this.contentTypeSelectNode.value;
        var record = this.records[this.currentRecordIndex];
        var data = record.getData();
        var firstTdEl = this.widgets.dataTable.getFirstTdEl(record);
        var contentTypeEl = Dom.getElementsByClassName(
            "fileupload-contentType-input", "input", firstTdEl);
        if (contentTypeEl && contentTypeEl.length === 1) {
            contentTypeEl[0].value = contentType;
        } else {
            console.log("contentTypeEl", contentTypeEl);
        }
        var secondTdEl = this.widgets.dataTable.getNextTdEl(firstTdEl);
        var typeInfoEl = Dom.getElementsByClassName(
            "fileupload-typeInfo-span", "span", secondTdEl);
        if (typeInfoEl && typeInfoEl.length === 1) {
            typeInfoEl[0].innerHTML =
                Alfresco.util.encodeHTML("Content type: " + contentType);
        } else {
            console.log("typeInfoEl", typeInfoEl);
        }

        var formRuntime = this.formUi.formsRuntime;
        var form = Dom.get(formRuntime.formId);
        var formData = formRuntime._buildAjaxForSubmit(form);
        this.fileStore[data.id].formData = formData;
        console.log("formData", formData, this);
    },

    onMetadataSubmit: function () {
        console.debug("onMetadataSubmit", this.formUi);
        this.formUi.formsRuntime._setAllFieldsAsVisited();
        if (this.formUi.formsRuntime.validate()) {
            this.processMetadata();
            this.currentRecordIndex++;
            this.showMetadataDialog();
        } else {
            Alfresco.util.PopupManager.displayMessage({
                text: this.msg("validation.errors.correct.before.proceeding")
            });
        }
    },

    onMetadataCancel: function () {
        console.debug("onMetadataCancel");
        this.records.reverse();
        for (var i = 0; i < this.records.length; i++) {
            var record = this.records[i];
            var flashId = record.getData().id;
            var recordId = record.getId();
            this._onFileButtonClickHandler(flashId, recordId);
        }
        this.showMainDialog();
    },

    onRowsAddEvent: function (arg) {
        console.debug("onRowsAddEvent", arg);
        if (this.showConfig.mode === this.MODE_SINGLE_UPDATE) {
            return;
        }
        this.savedDialogTitle =
            YAHOO.util.Dom.get(this.id + "-title-span").innerText;
        this.records = arg.records;
        this.currentRecordIndex = 0;
        this.showMetadataDialog();
    },

    showMetadataDialog: function () {
        console.debug("showMetadataDialog");
        if (this.currentRecordIndex == this.records.length) {
            return this.showMainDialog();
        }
        var currentRecord = this.records[this.currentRecordIndex];
        var data = currentRecord.getData();
        YAHOO.util.Dom.get(this.id + "-title-span").innerText =
            Alfresco.util.encodeHTML(data.name);

        YAHOO.util.Dom.addClass(this.id + "-main-dialog", "fake-hidden");
        YAHOO.util.Dom.removeClass(this.id + "-metadata-dialog", "hidden");

        this.contentTypeSelectNode.selectedIndex = 0;
        SoftwareLoop.fireEvent(this.contentTypeSelectNode, "change");
    },

    showMainDialog: function () {
        console.debug("showMainDialog");
        if (this.savedDialogTitle) {
            YAHOO.util.Dom.get(this.id + "-title-span").innerText =
                this.savedDialogTitle;
            delete this.savedDialogTitle;
        }

        delete this.records;
        delete this.currentRecordIndex;

        YAHOO.util.Dom.removeClass(this.id + "-main-dialog", "fake-hidden");
        YAHOO.util.Dom.addClass(this.id + "-metadata-dialog", "hidden");
    },

    _createEmptyDataTable: function () {
        SoftwareLoop.FlashUploadPlus.superclass._createEmptyDataTable.apply(
            this, arguments
        );
        this.widgets.dataTable.subscribe(
            "rowsAddEvent", this.onRowsAddEvent, this, true
        );
    },

    _resetGUI: function () {
        this.showMainDialog();
        SoftwareLoop.FlashUploadPlus.superclass._resetGUI.apply(this, arguments);
    },

    _uploadFromQueue: function FlashUploadPlus__uploadFromQueue(noOfUploadsToStart) {
        // generate upload POST url
        var url;
        if (this.showConfig.uploadURL === null) {
            url = Alfresco.constants.PROXY_URI + "api/upload";
        }
        else {
            url = Alfresco.constants.PROXY_URI + this.showConfig.uploadURL;
        }

        // Flash does not correctly bind to the session cookies during POST
        // so we manually patch the jsessionid directly onto the URL instead
        // also include the CSRF token to pass the CSRF token filter
        url += ";jsessionid=" + YAHOO.util.Cookie.get("JSESSIONID") + "?lang=" + Alfresco.constants.JS_LOCALE;

        // Pass the CSRF token if the CSRF token filter is enabled
        if (Alfresco.util.CSRFPolicy.isFilterEnabled()) {
            url += "&" + Alfresco.util.CSRFPolicy.getParameter() + "=" + encodeURIComponent(Alfresco.util.CSRFPolicy.getToken());
        }

        // Find files to upload
        var startedUploads = 0,
            length = this.widgets.dataTable.getRecordSet().getLength(),
            record, flashId, fileInfo, attributes;

        for (var i = 0; i < length && startedUploads < noOfUploadsToStart; i++) {
            record = this.widgets.dataTable.getRecordSet().getRecord(i);
            flashId = record.getData("id");
            fileInfo = this.fileStore[flashId];
            if (fileInfo.state === this.STATE_BROWSING) {
                // Upload has NOT been started for this file, start it now
                fileInfo.state = this.STATE_UPLOADING;

                attributes =
                {
                    username: this.showConfig.username
                };

                // Site or Non-site (Repository) mode
                if (this.showConfig.siteId !== null) {
                    attributes.siteId = this.showConfig.siteId;
                    attributes.containerId = this.showConfig.containerId;
                }
                else if (this.showConfig.destination !== null) {
                    attributes.destination = this.showConfig.destination
                }

                if (this.showConfig.mode === this.MODE_SINGLE_UPDATE) {
                    attributes.updateNodeRef = this.showConfig.updateNodeRef;
                    attributes.majorVersion = !this.minorVersion.checked;
                    attributes.description = this.description.value;
                }
                else {
                    if (this.showConfig.uploadDirectory !== null) {
                        attributes.uploadDirectory = this.showConfig.uploadDirectory;
                    }
                    if (fileInfo.contentType) {
                        if (fileInfo.contentType.tagName.toLowerCase() == "select") {
                            attributes.contentType = fileInfo.contentType.options[fileInfo.contentType.selectedIndex].value;
                        }
                        else {
                            attributes.contentType = fileInfo.contentType.value;
                        }
                    }
                    attributes.overwrite = this.showConfig.overwrite;
                    if (this.showConfig.thumbnails) {
                        attributes.thumbnails = this.showConfig.thumbnails;
                    }
                    // BEGIN: uploader-plus customisations
                    console.log("fileInfo", fileInfo);
                    if (fileInfo.formData) {
                        for (var current in fileInfo.formData) {
                            if (fileInfo.formData.hasOwnProperty(current) &&
                                current.indexOf("prop_") === 0) {
                                attributes[current] = fileInfo.formData[current];
                            }
                        }
                    }
                    console.log("Attributes:", attributes);
                    // END: uploader-plus customisations

                }

                this.uploader.upload(flashId, url, "POST", attributes, "filedata");
                startedUploads++;
            }
        }
    }

});
