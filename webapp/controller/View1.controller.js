sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/BusyIndicator"
], function (Controller, JSONModel, MessageToast, MessageBox, Fragment, Filter, FilterOperator, BusyIndicator) {
    "use strict";

    return Controller.extend("stockoverview.controller.View1", {

        onInit: function () {
            var oData = {
                filters: {
                    material: "",
                    plant: "",
                    storageLocation: ""
                },
                validation: {
                    materialState: "None"
                },
                stockHierarchy: [],
                selectedDetails: null,
                vh: {
                    title: "",
                    items: [],
                    field: ""
                }
            };

            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "stock");
        },

        onExecute: function () {
            var oStockModel = this.getView().getModel("stock");
            var sMaterial = oStockModel.getProperty("/filters/material");

            if (!sMaterial) {
                oStockModel.setProperty("/validation/materialState", "Error");
                MessageToast.show("Material is required");
                return;
            }

            oStockModel.setProperty("/validation/materialState", "None");
            oStockModel.setProperty("/selectedDetails", null);

            this._fetchStockData();
        },

        onClear: function () {
            var oModel = this.getView().getModel("stock");
            oModel.setProperty("/filters/material", "");
            oModel.setProperty("/filters/plant", "");
            oModel.setProperty("/filters/storageLocation", "");
            oModel.setProperty("/stockHierarchy", []);
            oModel.setProperty("/selectedDetails", null);
            oModel.setProperty("/validation/materialState", "None");
        },

        onNodeSelect: function (oEvent) {
            var oTable = oEvent.getSource();
            var iIndex = oTable.getSelectedIndex();
            var oModel = this.getView().getModel("stock");
            
            if (iIndex !== -1) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (oContext) {
                    var oSelectedNode = oModel.getProperty(oContext.getPath());
                    oModel.setProperty("/selectedDetails", oSelectedNode.details);
                    return;
                }
            }
            oModel.setProperty("/selectedDetails", null);
        },

        // --- OData Fetch Logic ---

        _fetchStockData: function () {
            var oView = this.getView();
            var oStockModel = oView.getModel("stock");
            var oODataModel = oView.getModel(); // default OData model

            var sMaterial = oStockModel.getProperty("/filters/material");
            var sPlant = oStockModel.getProperty("/filters/plant");
            var sStorageLocation = oStockModel.getProperty("/filters/storageLocation");

            // Build filters
            var aFilters = [];
            if (sMaterial) {
                aFilters.push(new Filter("Material", FilterOperator.EQ, sMaterial));
            }
            if (sPlant) {
                aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            }
            if (sStorageLocation) {
                aFilters.push(new Filter("StorageLocation", FilterOperator.EQ, sStorageLocation));
            }

            BusyIndicator.show(0);

            oODataModel.read("/A_MatlStkInAcctMod", {
                filters: aFilters,
                success: function (oData) {
                    BusyIndicator.hide();
                    var aResults = oData.results || [];

                    if (aResults.length === 0) {
                        MessageToast.show("No stock data found for the given filters.");
                        oStockModel.setProperty("/stockHierarchy", []);
                        return;
                    }

                    var aHierarchy = this._buildHierarchy(aResults);
                    oStockModel.setProperty("/stockHierarchy", aHierarchy);
                    MessageToast.show(aResults.length + " record(s) fetched.");
                }.bind(this),
                error: function (oError) {
                    BusyIndicator.hide();
                    var sMsg = "Failed to fetch stock data.";
                    try {
                        var oParsed = JSON.parse(oError.responseText);
                        sMsg = oParsed.error.message.value || sMsg;
                    } catch (e) {
                        // use default message
                    }
                    MessageBox.error(sMsg);
                }
            });
        },

        /**
         * Builds a tree hierarchy from flat OData results.
         * Hierarchy: Material → Plant → Storage Location → Batch
         * Each level aggregates MatlWrhsStkQtyInMatlBaseUnit.
         */
        _buildHierarchy: function (aResults) {
            var mMaterials = {};

            aResults.forEach(function (oItem) {
                var sMat = oItem.Material;
                var sPlant = oItem.Plant;
                var sSLoc = oItem.StorageLocation;
                var sBatch = oItem.Batch;
                var fQty = parseFloat(oItem.MatlWrhsStkQtyInMatlBaseUnit) || 0;
                var sUnit = oItem.MaterialBaseUnit || "";
                var sStockType = oItem.InventoryStockType || "";

                // Material level
                if (!mMaterials[sMat]) {
                    mMaterials[sMat] = {
                        name: sMat,
                        type: "Material",
                        icon: "sap-icon://product",
                        iconColor: "#0064d9",
                        unit: sUnit,
                        unrestricted: 0,
                        inspection: 0,
                        blocked: 0,
                        reserved: 0,
                        onOrder: 0,
                        details: { consignment: 0, project: 0, salesOrder: 0, transitPlant: 0, transitSloc: 0, expectedPO: 0, expectedProd: 0 },
                        plants: {},
                        nodes: []
                    };
                }
                var oMat = mMaterials[sMat];

                // Plant level
                if (!oMat.plants[sPlant]) {
                    oMat.plants[sPlant] = {
                        name: sPlant,
                        type: "Plant",
                        icon: "sap-icon://factory",
                        iconColor: "#333",
                        unit: sUnit,
                        unrestricted: 0,
                        inspection: 0,
                        blocked: 0,
                        reserved: 0,
                        onOrder: 0,
                        details: { consignment: 0, project: 0, salesOrder: 0, transitPlant: 0, transitSloc: 0, expectedPO: 0, expectedProd: 0 },
                        slocs: {},
                        nodes: []
                    };
                }
                var oPlant = oMat.plants[sPlant];

                // Storage Location level
                var sSLocKey = sSLoc || "(No SLoc)";
                if (!oPlant.slocs[sSLocKey]) {
                    oPlant.slocs[sSLocKey] = {
                        name: sSLocKey,
                        type: "SLoc",
                        icon: "sap-icon://database",
                        iconColor: "#666",
                        unit: sUnit,
                        unrestricted: 0,
                        inspection: 0,
                        blocked: 0,
                        reserved: 0,
                        onOrder: 0,
                        details: { consignment: 0, project: 0, salesOrder: 0, transitPlant: 0, transitSloc: 0, expectedPO: 0, expectedProd: 0 },
                        batches: {},
                        nodes: []
                    };
                }
                var oSLoc = oPlant.slocs[sSLocKey];

                // Classify quantity by stock type
                // InventoryStockType: 01 = Unrestricted, 02 = Quality Inspection, 03 = Blocked
                var sQtyField = "unrestricted";
                if (sStockType === "02") {
                    sQtyField = "inspection";
                } else if (sStockType === "03") {
                    sQtyField = "blocked";
                }

                // Batch level (leaf node)
                if (sBatch) {
                    if (!oSLoc.batches[sBatch]) {
                        oSLoc.batches[sBatch] = {
                            name: sBatch,
                            type: "Batch",
                            icon: "sap-icon://business-objects-experience",
                            iconColor: "#e9730c",
                            unit: sUnit,
                            unrestricted: 0,
                            inspection: 0,
                            blocked: 0,
                            reserved: 0,
                            onOrder: 0,
                            details: { consignment: 0, project: 0, salesOrder: 0, transitPlant: 0, transitSloc: 0, expectedPO: 0, expectedProd: 0 }
                        };
                    }
                    oSLoc.batches[sBatch][sQtyField] += fQty;
                }

                // Aggregate up the hierarchy
                oSLoc[sQtyField] += fQty;
                oPlant[sQtyField] += fQty;
                oMat[sQtyField] += fQty;

                // Special stock classification
                var sSpecialType = oItem.InventorySpecialStockType || "";
                if (sSpecialType === "K") { // Consignment
                    oSLoc.details.consignment += fQty;
                    oPlant.details.consignment += fQty;
                    oMat.details.consignment += fQty;
                } else if (sSpecialType === "Q") { // Project
                    oSLoc.details.project += fQty;
                    oPlant.details.project += fQty;
                    oMat.details.project += fQty;
                } else if (sSpecialType === "E") { // Sales Order
                    oSLoc.details.salesOrder += fQty;
                    oPlant.details.salesOrder += fQty;
                    oMat.details.salesOrder += fQty;
                }
            });

            // Convert maps to arrays (tree nodes)
            var aHierarchy = [];
            Object.keys(mMaterials).forEach(function (sMat) {
                var oMat = mMaterials[sMat];
                Object.keys(oMat.plants).forEach(function (sPlant) {
                    var oPlant = oMat.plants[sPlant];
                    Object.keys(oPlant.slocs).forEach(function (sSLoc) {
                        var oSLoc = oPlant.slocs[sSLoc];
                        // Add batch nodes
                        Object.keys(oSLoc.batches).forEach(function (sBatch) {
                            var oBatch = oSLoc.batches[sBatch];
                            oBatch.unrestricted = this._formatQty(oBatch.unrestricted, oBatch.unit);
                            oBatch.inspection = this._formatQty(oBatch.inspection, oBatch.unit);
                            oBatch.blocked = this._formatQty(oBatch.blocked, oBatch.unit);
                            oBatch.reserved = this._formatQty(oBatch.reserved, oBatch.unit);
                            oBatch.onOrder = this._formatQty(oBatch.onOrder, oBatch.unit);
                            oSLoc.nodes.push(oBatch);
                        }.bind(this));
                        delete oSLoc.batches;

                        oSLoc.unrestricted = this._formatQty(oSLoc.unrestricted, oSLoc.unit);
                        oSLoc.inspection = this._formatQty(oSLoc.inspection, oSLoc.unit);
                        oSLoc.blocked = this._formatQty(oSLoc.blocked, oSLoc.unit);
                        oSLoc.reserved = this._formatQty(oSLoc.reserved, oSLoc.unit);
                        oSLoc.onOrder = this._formatQty(oSLoc.onOrder, oSLoc.unit);
                        oPlant.nodes.push(oSLoc);
                    }.bind(this));
                    delete oPlant.slocs;

                    oPlant.unrestricted = this._formatQty(oPlant.unrestricted, oPlant.unit);
                    oPlant.inspection = this._formatQty(oPlant.inspection, oPlant.unit);
                    oPlant.blocked = this._formatQty(oPlant.blocked, oPlant.unit);
                    oPlant.reserved = this._formatQty(oPlant.reserved, oPlant.unit);
                    oPlant.onOrder = this._formatQty(oPlant.onOrder, oPlant.unit);
                    oMat.nodes.push(oPlant);
                }.bind(this));
                delete oMat.plants;

                oMat.unrestricted = this._formatQty(oMat.unrestricted, oMat.unit);
                oMat.inspection = this._formatQty(oMat.inspection, oMat.unit);
                oMat.blocked = this._formatQty(oMat.blocked, oMat.unit);
                oMat.reserved = this._formatQty(oMat.reserved, oMat.unit);
                oMat.onOrder = this._formatQty(oMat.onOrder, oMat.unit);
                aHierarchy.push(oMat);
            }.bind(this));

            return aHierarchy;
        },

        /**
         * Formats a numeric quantity with unit for display.
         * e.g. 1008.000 KG → "1,008 KG"
         */
        _formatQty: function (fValue, sUnit) {
            if (!fValue || fValue === 0) {
                return "0";
            }
            var sFormatted = Math.round(fValue).toLocaleString();
            return sUnit ? sFormatted + " " + sUnit : sFormatted;
        },

        // --- Value Help Logic ---

        _openValueHelp: function (sField, sTitle, aItems) {
            var oView = this.getView();
            var oModel = oView.getModel("stock");

            oModel.setProperty("/vh/field", sField);
            oModel.setProperty("/vh/title", sTitle);
            oModel.setProperty("/vh/items", aItems);

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "stockoverview.view.ValueHelpDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                oDialog.getBinding("items").filter([]);
                oDialog.open();
            });
        },

        onValueHelpMaterial: function () {
            var oODataModel = this.getView().getModel();
            var that = this;

            BusyIndicator.show(0);
            oODataModel.read("/A_MaterialStock", {
                urlParameters: {
                    "$select": "Material,MaterialBaseUnit"
                },
                success: function (oData) {
                    BusyIndicator.hide();
                    var aItems = (oData.results || []).map(function (o) {
                        return { key: o.Material, text: o.MaterialBaseUnit || "" };
                    });
                    that._openValueHelp("material", "Value Help: Material", aItems);
                },
                error: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Failed to load materials.");
                }
            });
        },

        onValueHelpPlant: function () {
            var oODataModel = this.getView().getModel();
            var oStockModel = this.getView().getModel("stock");
            var sMaterial = oStockModel.getProperty("/filters/material");
            var that = this;

            var aFilters = [];
            if (sMaterial) {
                aFilters.push(new Filter("Material", FilterOperator.EQ, sMaterial));
            }

            BusyIndicator.show(0);
            oODataModel.read("/A_MatlStkInAcctMod", {
                filters: aFilters,
                urlParameters: {
                    "$select": "Plant"
                },
                success: function (oData) {
                    BusyIndicator.hide();
                    // Deduplicate plants
                    var mSeen = {};
                    var aItems = [];
                    (oData.results || []).forEach(function (o) {
                        if (!mSeen[o.Plant]) {
                            mSeen[o.Plant] = true;
                            aItems.push({ key: o.Plant, text: o.Plant });
                        }
                    });
                    that._openValueHelp("plant", "Value Help: Plant", aItems);
                },
                error: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Failed to load plants.");
                }
            });
        },

        onValueHelpSLoc: function () {
            var oODataModel = this.getView().getModel();
            var oStockModel = this.getView().getModel("stock");
            var sMaterial = oStockModel.getProperty("/filters/material");
            var sPlant = oStockModel.getProperty("/filters/plant");
            var that = this;

            var aFilters = [];
            if (sMaterial) {
                aFilters.push(new Filter("Material", FilterOperator.EQ, sMaterial));
            }
            if (sPlant) {
                aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            }

            BusyIndicator.show(0);
            oODataModel.read("/A_MatlStkInAcctMod", {
                filters: aFilters,
                urlParameters: {
                    "$select": "StorageLocation"
                },
                success: function (oData) {
                    BusyIndicator.hide();
                    // Deduplicate storage locations
                    var mSeen = {};
                    var aItems = [];
                    (oData.results || []).forEach(function (o) {
                        if (o.StorageLocation && !mSeen[o.StorageLocation]) {
                            mSeen[o.StorageLocation] = true;
                            aItems.push({ key: o.StorageLocation, text: o.StorageLocation });
                        }
                    });
                    that._openValueHelp("storageLocation", "Value Help: Storage Location", aItems);
                },
                error: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Failed to load storage locations.");
                }
            });
        },

        onValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new Filter([
                new Filter("key", FilterOperator.Contains, sValue),
                new Filter("text", FilterOperator.Contains, sValue)
            ], false);
            oEvent.getSource().getBinding("items").filter(oFilter);
        },

        onValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sKey = oSelectedItem.getTitle();
                var oModel = this.getView().getModel("stock");
                var sField = oModel.getProperty("/vh/field");
                oModel.setProperty("/filters/" + sField, sKey);
                
                // Clear validation error if material was selected
                if (sField === "material") {
                    oModel.setProperty("/validation/materialState", "None");
                }
            }
        },

        onValueHelpCancel: function () {
            // Nothing to do
        }

    });
});