/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["stockoverview/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
