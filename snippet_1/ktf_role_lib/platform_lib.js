/*
 * /lib/ktf_role_lib/platform_lib.js
 * KTF Hyperledger Composer Platform Library
*/
'use strict';

/**
 * @module platformLib
 * @desc Contains platform library methods
 */
module.exports = function(ktfLib) {
    var platLib = {} // To export functions to be used publicly

    /* Asset Related functions  */

    /**
     * Function to cancel Shipment before "CONFIRMED" state
     * @async
     * @function markUnconfirmedShipment
     * @memberof module:platformLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     */
    platLib.markUnconfirmedShipment = async function(shipmentId) {
        let markUnconfirmedShipmentTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'MarkUnconfirmedShipment');
        markUnconfirmedShipmentTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        await ktfLib.connection.submitTransaction(markUnconfirmedShipmentTx);
    }

    /**
     * Function to reduce Shipment trade amount if shipment is damaged with proof attached
     * @async
     * @function reduceTransactionAmount
     * @memberof module:platformLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     * @param {Integer} reduction - Reduction amount
     * @param {String} reason - Reason for reducing amount
     * @param {Object[]} attachments - List of attachments as proof
     */
    platLib.reduceTransactionAmount = async function(shipmentId, reduction, reason, attachments) {
        let docAttachments = [];
        let factory = ktfLib.factory;
        let namespace = ktfLib.namespace;

        attachments.forEach(function(attachment){
            let docAttachment = factory.newConcept(namespace, "DocumentAttachment");
            docAttachment.docClass = factory.newRelationship(namespace, 'DocumentClass', attachment.docClass);
            docAttachment.docHash = attachment.docHash;
            docAttachment.comment = reason;
            docAttachments.push(docAttachment);
        })

        let reduceTxAmt = ktfLib.factory.newTransaction(ktfLib.namespace, 'ReduceTransactionAmount');
        reduceTxAmt.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        reduceTxAmt.attachments = docAttachments;
        reduceTxAmt.reduction = reduction;

        await ktfLib.connection.submitTransaction(reduceTxAmt);
    }

    // Underwriting Limit
    // Create underwriting limit for plaform user
    /**
     * Function to create underwriting limit for platform user
     * @async
     * @function createPlatformUnderwritingLimit
     * @memberof module:platformLib
     * @instance
     * @param {String} modelType - Model Type
     * @param {String} modelId - Model Id
     * @param {Integer} limitAmount - Limit Amount
     */
    platLib.createPlatformUnderwritingLimit = async function(modelType, modelId, limitAmount) {
        switch (modelType) {
            case 'Product': case 'Region': case 'Exporter': case 'Importer':
                var settingId = 'lmt_' + Math.floor(Math.random() * 100000);
                var createPlatformUnderwritingLimitTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'CreatePlatformUnderwritingLimit')
                createPlatformUnderwritingLimitTx.settingId = settingId;
                createPlatformUnderwritingLimitTx.modelType = modelType;
                createPlatformUnderwritingLimitTx.modelId = modelId;
                createPlatformUnderwritingLimitTx.limitAmount = limitAmount;
                await ktfLib.connection.submitTransaction(createPlatformUnderwritingLimitTx)
                    .catch(err => {
                        throw ktfLib.filterError(err);
                    });
                return settingId;
            default:
                throw new Error(`Invalid model type: Expecting one of "Prodcut", "Region", "Exporter", or "Importer". But ${modelType} is detected.`)
        }
    }

    return platLib;
}