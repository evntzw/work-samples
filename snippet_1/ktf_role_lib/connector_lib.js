/*
 * /lib/ktf_role_lib/connector_lib.js
 * KTF Hyperledger Composer Connector Library (composer-listener)
*/
'use strict';

/**
 * @module connectorLib
 * @desc Contains connector library methods
 */
module.exports = function(ktfLib) {
    var connectorLib = {} // To export functions to be used publicly

    /**
     * Function to confirm the change in Shipment state
     * @async
     * @function confirmShipmentState
     * @memberof module:connectorLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @param {String} confirmedState - Confirmed shipment
     * @param {String} txHash - Transaction Hash
     */
    connectorLib.confirmShipmentState = async function(shipmentId, confirmedState, txHash) {
        console.log("confirmShipmentState ",confirmedState)
        var confirmShipmentStateTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'ConnectorConfirmShipmentState');
        confirmShipmentStateTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        confirmShipmentStateTx.confirmedState = confirmedState;
        confirmShipmentStateTx.txHash = txHash;
        await ktfLib.connection.submitTransaction(confirmShipmentStateTx);
    }

    return connectorLib;
}
