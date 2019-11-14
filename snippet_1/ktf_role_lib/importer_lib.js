/*
 * /lib/ktf_role_lib/importer_lib.js
 * KTF Hyperledger Composer Improter Library
*/
'use strict';

/**
 * @module importerLib
 * @desc Contains importer library methods
 */
module.exports = function(ktfLib) {
    var importerLib = {} // To export functions to be used publicly

    /* Asset Related Functions*/

    /**
     * Function to get all Offer assets in Importer's region
     * @async
     * @function listOffers
     * @memberof module:importerLib
     * @instance
     * @returns {Offer[]} - List of Offers in Importer's region
     */
    importerLib.listOffers = async function() {
        let listOffersTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'ListActiveOffers');
        var offers = await ktfLib.connection.submitTransaction(listOffersTx);
        return offers.map(ktfLib.filterAsset);
    }

    /**
     * Function to get a particular Offer asset in Importer's region
     * @async
     * @function getOffer
     * @memberof module:importerLib
     * @instance
     * @param {String} offerId - Offer Id
     * @returns {Offer[]} - List of Offers in Importer's region
     */
    importerLib.getOffer = async function(offerId) {
        let getOfferTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'GetActiveOffer');
        getOfferTx.offer = ktfLib.factory.newRelationship(ktfLib.namespace, 'Offer', offerId);
        return ktfLib.filterAsset(await ktfLib.connection.submitTransaction(getOfferTx));
    }

    /**
     * Function to get all Shipment assets related to Importer
     * @async
     * @function listShipments
     * @memberof module:importerLib
     * @instance
     * @returns {Shipment[]} - List of Shipments related to Importer
     */
    importerLib.listShipments = async function() {
        return await ktfLib.common.submitListShipmentsTx('Importer');
    }

    /**
     * Function to get a particular Shipment asset related to Importer
     * @async
     * @function getShipment
     * @memberof module:importerLib
     * @instance
     * @param {String} shipmentId - ShipmentId
     * @returns {Shipment[]} - List of Shipments related to Importer
     */
    importerLib.getShipment = async function(shipmentId) {
        return await ktfLib.common.submitGetShipmentTx('Importer', shipmentId);
    }

    // Create a shipment asset
    /**
     * Function to create a Shipment asset
     * @async
     * @function createShipment
     * @memberof module:importerLib
     * @instance
     * @param {String} offerId - Offer Id
     * @param {String} poolId - Pool Id
     * @param {String} logisticsId - Logistics Id
     * @param {Integer} amount - Amount
     * @param {String} ethAddress - Ethereum Address
     * @returns {String} - Shipment Id
     */
    importerLib.createShipment = async function(offerId, poolId, logisticsId, amount, ethAddress) {
        const t0 = 100000; // FIXME: Should be get from backend settings
        const shipmentId = 'ship_' + Math.floor(Math.random() * 10000000);
        let makeShipmentTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'MakeShipment');
        makeShipmentTx.offer = ktfLib.factory.newRelationship(ktfLib.namespace, 'Offer', offerId);
        makeShipmentTx.newShipmentId = shipmentId;
        makeShipmentTx.pool = ktfLib.factory.newRelationship(ktfLib.namespace, 'Pool', poolId);
        makeShipmentTx.logistics = ktfLib.factory.newRelationship(ktfLib.namespace, 'Logistics', logisticsId);
        makeShipmentTx.importerAddr = ethAddress;
        makeShipmentTx.amount = amount;
        makeShipmentTx.startDate = (new Date()).getTime();
        makeShipmentTx.t0 = t0;

        await ktfLib.connection.submitTransaction(makeShipmentTx)
            .catch(err => {
                throw ktfLib.filterError(err)
            });
        return shipmentId;
    }

    return importerLib;
}