/*
 * /lib/ktf_role_lib/common_lib.js
 * KTF Hyperledger Composer Common Library
*/
'use strict';

/**
 * @module commonLib
 * @desc Contains common library methods
 */
module.exports = function(ktfLib) {
    var commonLib = {} // To export functions to be used publicly

    /* Participant Related Functions*/

    /**
     * Function to return all Exporter participants
     * @async
     * @function createDocumentClass
     * @memberof module:commonLib
     * @instance
     * @returns {Exporter[]} - List of Exporters
     */
    commonLib.listExporters = async function() {
        return await ktfLib.getParticipants('Exporter');
    }

    /**
     * Function to return all Importer participants
     * @async
     * @function listImporters
     * @memberof module:commonLib
     * @instance
     * @returns {Importer[]} - List of Importers
     */
    commonLib.listImporters = async function() {
        return await ktfLib.getParticipants('Importer');
    }

    /**
     * Function to return all Logistics participants
     * @async
     * @function listLogistics
     * @memberof module:commonLib
     * @instance
     * @returns {Logistics[]} - List of Logistics
     */
    commonLib.listLogistics = async function() {
        return await ktfLib.getParticipants('Logistics');
    }

    /* Asset Related Functions*/

    /**
     * Function to return all Region assets
     * @async
     * @function getRegions
     * @memberof module:commonLib
     * @instance
     * @returns {Region[]} - List of Regions
     */
    commonLib.getRegions = async function() {
        return await ktfLib.getAssets('Region');
    }

    /**
     * Function to return all Product assets
     * @async
     * @function getProducts
     * @memberof module:commonLib
     * @instance
     * @returns {Product[]} - List of Products
     */
    commonLib.getProducts = async function() {
        return await ktfLib.getAssets('Product');
    }

    /**
     * Function to return all Pool assets
     * @async
     * @function listPools
     * @memberof module:commonLib
     * @instance
     * @returns {Pool[]} - List of Pools
     */
    commonLib.listPools = async function() {
        return await ktfLib.getAssets('Pool');
    }

   /**
     * Function to return all Offer assets
     * @async
     * @function listOffers
     * @memberof module:commonLib
     * @instance
     * @returns {Offer[]} - List of Offers
     */
    commonLib.listOffers = async function() {
        return await ktfLib.getAssets('Offer');
    }

    /**
     * Function to return a particular Offer asset
     * @async
     * @function getOffer
     * @memberof module:commonLib
     * @instance
     * @param {String} offerId - Offer Id
     * @returns {Offer} - Offer asset
     */
    commonLib.getOffer = async function(offerId) {
        return await ktfLib.getAsset('Offer', offerId);
    }

    /**
     * Function to return all Shipment assets
     * @async
     * @function listShipments
     * @memberof module:commonLib
     * @instance
     * @returns {Shipment[]} - List of Shipments
     */
    commonLib.listShipments = async function() {
        return await ktfLib.getAssets('Shipment');
    }

    /**
     * Function to return a particular Shipment asset
     * @async
     * @function getShipment
     * @memberof module:commonLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @returns {Shipment} - Shipment asset
     */
    commonLib.getShipment = async function(shipmentId) {
        return await ktfLib.getAsset('Shipment', shipmentId);
    }

    /**
     * Function to update state of Shipment asset
     * @async
     * @function updateShipmentState
     * @memberof module:commonLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @param {String} state - new state
     * @param {String} role - Participant role
     * @throws Will throw an error if role is not platform, inspector or connector
     */
    commonLib.updateShipmentState = async function(shipmentId, state, role) {
        if (state == "TERMINATED" || state == "COMPLETED") {
            var recoverUnderwritingLimitTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'RecoverUnderwritingLimit')
            recoverUnderwritingLimitTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
            await ktfLib.connection.submitTransaction(recoverUnderwritingLimitTx)
        }

        let txName;
        switch(role){
          case 'platform': txName = 'PlatformPendingShipmentState'; break;
          case 'inspector': txName = 'InspectorPendingShipmentState'; break;
          case 'connector': txName = 'ConnectorPendingShipmentState'; break;
          default: throw new Error("Invalid role "+role+" for updateShipmentState()");
        }

        var updateShipmentStateTx = ktfLib.factory.newTransaction(ktfLib.namespace, txName);
        updateShipmentStateTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        updateShipmentStateTx.state = state;
        await ktfLib.connection.submitTransaction(updateShipmentStateTx);
    }   

    /**
     * Function to invoke attachDocument transaction for inspector1, inspector2, platform
     * @async
     * @function attachDocument
     * @memberof module:commonLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @param {Object[]} attachments - List of attachments
     */
    commonLib.attachDocument = async function(shipmentId, attachments) {
        let docAttachments = [];
        let factory = ktfLib.factory;
        let namespace = ktfLib.namespace;

        attachments.forEach(function(attachment){
            let docAttachment = factory.newConcept(namespace, "DocumentAttachment");
            docAttachment.docClass = factory.newRelationship(namespace, 'DocumentClass', attachment.docClass);
            docAttachment.docHash = attachment.docHash;
            docAttachments.push(docAttachment);
        })

        let attachDocumentTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'AttachDocumentToShipment');
        attachDocumentTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        attachDocumentTx.attachments = docAttachments;

        await ktfLib.connection.submitTransaction(attachDocumentTx);
    }

    /**
     * Function to invoke ListShipments transaction for exporter, importer, logistics or financier
     * @async
     * @function submitListShipmentsTx
     * @memberof module:commonLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @param {Object[]} role - Participant role
     * @returns {Shipment[]} - List of Shipments
     * @throws Will throw an error if role is not exporter, importer, logistics or financier
     */
    commonLib.submitListShipmentsTx = async function(role) {
        switch (role) {
            case 'Exporter': case 'Importer': case 'Logistics': case 'Financier':
                let listShipmentsTx = ktfLib.factory.newTransaction(ktfLib.namespace, `${role}ListShipments`);
                var shipments = await ktfLib.connection.submitTransaction(listShipmentsTx);
                return shipments.map(ktfLib.filterAsset);
            default:
                throw new Error(`Illegal caller role: caller should be one of "Exporter", "Importer", "Logistics" or "Financier", but ${role} is detected.`)
        }
    }

    /**
     * Function to invoke GetShipment transaction for exporter, importer, logistics or financier
     * @async
     * @function submitListShipmentsTx
     * @memberof module:commonLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @param {Object[]} role - Participant role
     * @throws Will throw an error if role is not exporter, importer, logistics or financier
     */
    commonLib.submitGetShipmentTx = async function(role, shipmentId) {
        switch (role) {
            case 'Exporter': case 'Importer': case 'Logistics': case 'Financier':
                let getShipmentTx = ktfLib.factory.newTransaction(ktfLib.namespace, `${role}GetShipment`);
                getShipmentTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
                return ktfLib.filterAsset(await ktfLib.connection.submitTransaction(getShipmentTx));
            default:
                throw new Error(`Illegal caller role: caller should be one of "Exporter", "Importer", "Logistics" or "Financier", but ${role} is detected.`)
        }
    }

    /**
     * Function to return all Underwriting Limit assets
     * @async
     * @function listUnderwritingLimits
     * @memberof module:commonLib
     * @instance
     * @returns {UnderwritingLimit[]} - List of UnderwritingLimits
     */
    commonLib.listUnderwritingLimits = async function() {
        return await ktfLib.getAssets('UnderwritingLimitSetting');
    }

    /**
     * Function to return a particular Underwriting Limit asset
     * @async
     * @function getUnderwritingLimit
     * @memberof module:commonLib
     * @instance
     * @param {String} settingId - UnderwritingLimit Id
     * @returns {UnderwritingLimit} - UnderwritingLimit asset
     */
    commonLib.getUnderwritingLimit = async function(settingId) {
        return await ktfLib.getAsset('UnderwritingLimitSetting', settingId);
    }

    /**
     * Function to remove a particular Underwriting Limit asset
     * @async
     * @function removeUnderwritingLimit
     * @memberof module:commonLib
     * @instance
     * @param {String} settingId - UnderwritingLimit Id
     */
    commonLib.removeUnderwritingLimit = async function(settingId) {
        await ktfLib.removeAsset('UnderwritingLimitSetting', settingId)
    }

    return commonLib;
}