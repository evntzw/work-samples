/*
 * /lib/ktf_role_lib/logistics_lib.js
 * KTF Hyperledger Composer Logistics Library
*/
'use strict';

/**
 * @module logisticsLib
 * @desc Contains logistics library methods
 */
module.exports = function(ktfLib) {
    var logLib = {} // To export functions to be used publicly

    /* Asset Related functions  */
    
    /**
     * Function to get all Shipments related to Logistics
     * @async
     * @function listShipments
     * @memberof module:logisticsLib
     * @instance
     * @returns {Shipment[]} - List of Shipments relating to Logistics
     */
    logLib.listShipments = async function() {
        return await ktfLib.common.submitListShipmentsTx('Logistics');
    }
    
    /**
     * Function to get a particular Shipment related to Logistics
     * @async
     * @function getShipment
     * @memberof module:logisticsLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @returns {Shipment} - Shipment relating to Logistics
     */
    logLib.getShipment = async function(shipmentId) {
        return await ktfLib.common.submitGetShipmentTx('Logistics', shipmentId);
    }

     /**
     * Function to let logistics confirm shipment when shipment first created
     * @async
     * @function confirmShipmentByLogistics
     * @memberof module:logisticsLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @returns {Shipment} - Shipment relating to Logistics
     */
    logLib.confirmShipmentByLogistics = async function(shipmentId, ethAddress) {
        let confirmShipmentByLogisticsTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'ConfirmShipmentByLogistics');
        confirmShipmentByLogisticsTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        confirmShipmentByLogisticsTx.logisticsAddr = ethAddress;
        await ktfLib.connection.submitTransaction(confirmShipmentByLogisticsTx);
    }

    return logLib;
}