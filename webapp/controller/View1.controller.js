sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageToast, Fragment, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("stockoverview.controller.View1", {

        onInit: function () {
            var oData = {
                filters: {
                    material: "RM-100",
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

            this._loadMockData();
        },

        onExecute: function () {
            var oModel = this.getView().getModel("stock");
            var sMaterial = oModel.getProperty("/filters/material");

            if (!sMaterial) {
                oModel.setProperty("/validation/materialState", "Error");
                MessageToast.show("Material is required");
                return;
            }

            oModel.setProperty("/validation/materialState", "None");
            oModel.setProperty("/selectedDetails", null); // Reset selection
            
            // Simulate backend delay
            MessageToast.show("Refreshing data...");
            setTimeout(function() {
                this._loadMockData();
            }.bind(this), 300);
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
            this._openValueHelp("material", "Value Help: Material", [
                { key: "RM-100", text: "Steel Sheet (Raw)" },
                { key: "RM-200", text: "Aluminum Block" },
                { key: "FG-001", text: "Finished Engine Component" }
            ]);
        },

        onValueHelpPlant: function () {
            this._openValueHelp("plant", "Value Help: Plant", [
                { key: "1000", text: "Hamburg Factory" },
                { key: "1100", text: "Berlin Distribution" },
                { key: "2000", text: "New York Assembly" }
            ]);
        },

        onValueHelpSLoc: function () {
            this._openValueHelp("storageLocation", "Value Help: Storage Location", [
                { key: "0001", text: "Raw Materials Storage" },
                { key: "0002", text: "Semi-Finished Goods" },
                { key: "0003", text: "Quality Assurance" }
            ]);
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
        },

        // --- Mock Data Generator ---

        _loadMockData: function () {
            var oModel = this.getView().getModel("stock");
            var sMatInput = oModel.getProperty("/filters/material") || "RM-100";
            var sPlInput = oModel.getProperty("/filters/plant");
            var bIsRM100 = sMatInput.indexOf("RM-100") > -1;

            var aMockData = [
                {
                    name: sMatInput + (bIsRM100 ? " (Steel Sheet)" : " (Material)"),
                    type: "Material", icon: "sap-icon://product", iconColor: "#0064d9",
                    unrestricted: "12,500", inspection: "400", blocked: "50", reserved: "2,000", onOrder: "5,000",
                    details: { consignment: "1,000", project: "500", salesOrder: "200", transitPlant: "1,500", transitSloc: "0", expectedPO: "5,000", expectedProd: "0" },
                    nodes: [
                        {
                            name: sPlInput || "1000 (Hamburg Factory)",
                            type: "Plant", icon: "sap-icon://factory", iconColor: "#333",
                            unrestricted: "8,500", inspection: "250", blocked: "50", reserved: "1,500", onOrder: "3,000",
                            details: { consignment: "600", project: "300", salesOrder: "100", transitPlant: "0", transitSloc: "200", expectedPO: "3,000", expectedProd: "0" },
                            nodes: [
                                {
                                    name: "0001 (Raw Materials Storage)",
                                    type: "SLoc", icon: "sap-icon://database", iconColor: "#666",
                                    unrestricted: "5,000", inspection: "0", blocked: "0", reserved: "1,000", onOrder: "2,000",
                                    details: { consignment: "600", project: "0", salesOrder: "0", transitPlant: "0", transitSloc: "0", expectedPO: "2,000", expectedProd: "0" },
                                    nodes: [
                                        {
                                            name: "B-00X1 (Batch Standard)",
                                            type: "Batch", icon: "sap-icon://business-objects-experience", iconColor: "#e9730c",
                                            unrestricted: "3,000", inspection: "0", blocked: "0", reserved: "1,000", onOrder: "0",
                                            details: { consignment: "0", project: "0", salesOrder: "0", transitPlant: "0", transitSloc: "0", expectedPO: "0", expectedProd: "0" }
                                        },
                                        {
                                            name: "B-00X2 (Batch Premium)",
                                            type: "Batch", icon: "sap-icon://business-objects-experience", iconColor: "#e9730c",
                                            unrestricted: "2,000", inspection: "0", blocked: "0", reserved: "0", onOrder: "0",
                                            details: { consignment: "600", project: "0", salesOrder: "0", transitPlant: "0", transitSloc: "0", expectedPO: "0", expectedProd: "0" }
                                        }
                                    ]
                                },
                                {
                                    name: "0003 (Quality Assurance)",
                                    type: "SLoc", icon: "sap-icon://database", iconColor: "#666",
                                    unrestricted: "0", inspection: "250", blocked: "50", reserved: "0", onOrder: "0",
                                    details: { consignment: "0", project: "0", salesOrder: "0", transitPlant: "0", transitSloc: "200", expectedPO: "0", expectedProd: "0" },
                                    nodes: [
                                        {
                                            name: "B-00X3 (Held Batch)",
                                            type: "Batch", icon: "sap-icon://business-objects-experience", iconColor: "#e9730c",
                                            unrestricted: "0", inspection: "250", blocked: "50", reserved: "0", onOrder: "0",
                                            details: { consignment: "0", project: "0", salesOrder: "0", transitPlant: "0", transitSloc: "0", expectedPO: "0", expectedProd: "0" }
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            name: "1100 (Berlin Distribution)",
                            type: "Plant", icon: "sap-icon://factory", iconColor: "#333",
                            unrestricted: "4,000", inspection: "150", blocked: "0", reserved: "500", onOrder: "2,000",
                            details: { consignment: "400", project: "200", salesOrder: "100", transitPlant: "1,500", transitSloc: "0", expectedPO: "2,000", expectedProd: "0" },
                            nodes: [
                                {
                                    name: "0001 (Main Warehouse)",
                                    type: "SLoc", icon: "sap-icon://database", iconColor: "#666",
                                    unrestricted: "4,000", inspection: "150", blocked: "0", reserved: "500", onOrder: "2,000",
                                    details: { consignment: "400", project: "200", salesOrder: "100", transitPlant: "0", transitSloc: "0", expectedPO: "2,000", expectedProd: "0" }
                                }
                            ]
                        }
                    ]
                }
            ];

            oModel.setProperty("/stockHierarchy", aMockData);
        }

    });
});