/*
 * /lib/ktf_role_lib/exporter_lib.js
 * KTF Hyperledger Composer Exporter Library
*/
'use strict';

/**
 * @module exporterLib
 * @desc Contains exporter library methods
 */
module.exports = function(ktfLib) {
    var exporterLib = {} // To export functions to be used publicly

    /* Asset Related functions  */

    /**
     * Function to return a particular Offer asset
     * @async
     * @function createOffer
     * @memberof module:exporterLib
     * @instance
     * @param {String} productId - Product Id
     * @param {String} regionId - Region Id
     * @param {Float} price - price
     * @param {Integer} amount - quantity
     * @param {Date} expiryDateStr - Expiry Date
     * @param {String} productId - Product Id
     * @param {Integer} t1 - t1
     * @param {Integer} t2 - t2
     * @returns {String} - Offer Id
     */
    exporterLib.createOffer = async function(productId, regionId, price, amount, expiryDateStr, t1, t2) {
        const offerId = 'off_' + Math.floor(Math.random() * 100000);
        var expiryDate = new Date(expiryDateStr);
        expiryDate.setHours(23, 59, 59, 999);
        t2 = t2 + 1000 //FIXME: find a proper buffer time

        var exporterCreateOffer = ktfLib.factory.newTransaction(ktfLib.namespace, 'ExporterCreateOffer');
        exporterCreateOffer.offerId = offerId;
        exporterCreateOffer.exporter = ktfLib.factory.newRelationship(ktfLib.namespace, 'Exporter', ktfLib.userName);
        exporterCreateOffer.product = ktfLib.factory.newRelationship(ktfLib.namespace, 'Product', productId);
        exporterCreateOffer.price = price;
        exporterCreateOffer.amount = amount;
        exporterCreateOffer.availableAmount = amount;
        exporterCreateOffer.region = ktfLib.factory.newRelationship(ktfLib.namespace, 'Region', regionId);
        exporterCreateOffer.expiryDate = expiryDate.getTime();
        exporterCreateOffer.t1 = t1;
        exporterCreateOffer.t2 = t2;

        await ktfLib.connection.submitTransaction(exporterCreateOffer)
            .catch(err => {
                throw ktfLib.filterError(err);
            });
        return offerId;
    }

    /**
     * Function to update Offer asset
     * @async
     * @function updateOffer
     * @memberof module:exporterLib
     * @instance
     * @param {String} offerId - Offer Id
     * @param {Offer} offerObj - New offer asset
     * @returns {Offer} - Updated Offer
     */
    exporterLib.updateOffer = async function(offerId, offerObj) {
        return await ktfLib.updateAsset('Offer', offerId, offerObj);
    }

    /**
     * Function to return all Shipments relating to Exporter
     * @async
     * @function listShipments
     * @memberof module:exporterLib
     * @instance
     * @returns {Shipment[]} - List of Shipments relating to Exporter
     */
    exporterLib.listShipments = async function() {
        return await ktfLib.common.submitListShipmentsTx('Exporter');
    }

    /**
     * Function to return a particular Shipment relating to Exporter
     * @async
     * @function getShipment
     * @memberof module:exporterLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @returns {Shipment} - Shipment relating to Exporter
     */
    exporterLib.getShipment = async function(shipmentId) {
        return await ktfLib.common.submitGetShipmentTx('Exporter', shipmentId);
    }

    /**
     * Function to let Exporter confirm Shipment, when Shipment is first created
     * @async
     * @function confirmShipmentByExporter
     * @memberof module:exporterLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @param {String} ethAddress - Ethereum Address
     */
    exporterLib.confirmShipmentByExporter = async function(shipmentId, ethAddress) {
        let confirmShipmentByExporterTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'ConfirmShipmentByExporter');
        confirmShipmentByExporterTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        confirmShipmentByExporterTx.exporterAddr = ethAddress;
        await ktfLib.connection.submitTransaction(confirmShipmentByExporterTx);
    }

    return exporterLib;
}