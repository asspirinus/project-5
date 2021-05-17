
import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getRelatedRecords from '@salesforce/apex/OpportunityRelatedListController.getRelatedRecords';
import saveDraftValues from '@salesforce/apex/OpportunityRelatedListController.saveDraftValues';
import deleteOpportunities from '@salesforce/apex/OpportunityRelatedListController.deleteOpportunities'

const actions = [
    { label: 'Edit', name: 'edit'}, 
    { label: 'Delete', name: 'delete'},
    { label: 'Change Owner', name: 'change_owner'}
];
const COLUMNS = [
    {
        label: 'Opportunity Name',
        fieldName: 'linkName',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_self'
        }
    },
    {
        label: 'Account Name',
        fieldName: 'AccountId',
        type: 'lookup',
        typeAttributes: {
            placeholder: 'Choose Account',
            object: 'Opportunity',
            fieldName: 'AccountId',
            label: 'Account',
            value: { fieldName: 'AccountId' },
            context: { fieldName: 'Id' },
            variant: 'label-hidden',
            name: 'Account',
            fields: ['Account.Name'],
            target: '_self'
        },
        editable: true,
        cellAttributes: {
            class: { fieldName: 'accountNameClass' }
        }
    },
    {
        label: 'Amount',
        fieldName: 'Amount',
        type: 'currency',
        editable: true
    },
    {
        label: 'Close Date',
        fieldName: 'CloseDate',
        type: 'date-local',
        typeAttributes: {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        },
        editable: true
    },
    {
        label: 'Stage',
        fieldName: 'StageName',
        type: 'picklist',
        editable: true,
        typeAttributes: {
            placeholder: 'Choose Stage',
            options: [
                { label: 'Prospecting', value: 'Prospecting' },
                { label: 'Qualifications', value: 'Qualifications' },
                { label: 'Needs Analysis', value: 'Needs Analysis' },
                { label: 'Value Proposition', value: 'Value Proposition' },
                { label: 'Id. Decision Makers', value: 'Id. Decision Makers' },
                { label: 'Perception Analysis', value: 'Perception Analysis' },
                { label: 'Proposal/Price Quote', value: 'Proposal/Price Quote' },
                { label: 'Negotiation/Review', value: 'Negotiation/Review' },
                { label: 'Closed Won', value: 'Closed Won' },
                { label: 'Closed Lost', value: 'Closed Lost' }
            ],
            value: { fieldName: 'StageName' },
            context: { fieldName: 'Id' },
            variant: 'label-hidden',
            name: 'Stage',
            label: 'Stage'
        },
        cellAttributes: {
            class: { fieldName: 'stageClass' }
        }
    },
    {
        type: 'action',
        typeAttributes: {
            rowActions: actions,
            menuAlignment: 'right'
        }
    }
];

export default class OpportunitiesTable extends LightningElement {
    columns = COLUMNS;
    records;
    lastSavedData;
    @track currentRecordId;
    error;
    accountId;
    wiredRecords;
    showSpinner = false;
    editOpportunities = false;
    newOpportunities = false;
    changeOwner = false;
    draftValues = [];
    privateChildren = {};

    renderedCallback() {
        if (!this.isComponentLoaded) {
            window.addEventListener('click', (evt) => {
                this.handleWindowOnclick(evt);
            });
            this.isComponentLoaded = true;
        }
    }

    disconnectedCallback() {
        window.removeEventListener('click', () => { });
    }

    handleWindowOnclick(context) {
        this.resetPopups('c-datatable-picklist', context);
        this.resetPopups('c-datatable-lookup', context);
    }

    resetPopups(markup, context) {
        let elementMarkup = this.privateChildren[markup];
        if (elementMarkup) {
            Object.values(elementMarkup).forEach((element) => {
                element.callbacks.reset(context);
            });
        }
    }

    @wire(getRelatedRecords)
    wiredRelatedRecords(result) {
        this.wiredRecords = result;
        const { data, error } = result;
        if (data) {
            this.records = JSON.parse(JSON.stringify(data));
            this.records.forEach(record => {
                record.linkName = '/' + record.Id;
                record.accountNameClass = 'slds-cell-edit';
                record.stageClass = 'slds-cell-edit';
            });
            this.error = undefined;
        } else if (error) {
            this.records = undefined;
            this.error = error;
        } else {
            this.error = undefined;
            this.records = undefined;
        }
        this.lastSavedData = this.records;
        this.showSpinner = false;
    }

    handleItemRegister(event) {
        event.stopPropagation();
        const item = event.detail;
        if (!this.privateChildren.hasOwnProperty(item.name))
            this.privateChildren[item.name] = {};
        this.privateChildren[item.name][item.guid] = item;
    }

    handleChange(event) {
        event.preventDefault();
        this.accountId = event.target.value;
        this.showSpinner = true;
    }

    handleCancel(event) {
        event.preventDefault();
        this.records = JSON.parse(JSON.stringify(this.lastSavedData));
        this.handleWindowOnclick('reset');
        this.draftValues = [];
    }

    handleCellChange(event) {
        event.preventDefault();
        this.updateDraftValues(event.detail.draftValues[0]);
    }

    handleValueChange(event) {
        event.stopPropagation();
        let dataRecieved = event.detail.data;
        let updatedItem;
        switch (dataRecieved.label) {
            case 'Account':
                updatedItem = {
                    Id: dataRecieved.context,
                    AccountId: dataRecieved.value
                };
                this.setClassesOnData(
                    dataRecieved.context,
                    'accountNameClass',
                    'slds-cell-edit slds-is-edited'
                );
                break;
            case 'Stage':
                updatedItem = {
                    Id: dataRecieved.context,
                    StageName: dataRecieved.value
                };
                this.setClassesOnData(
                    dataRecieved.context,
                    'stageClass',
                    'slds-cell-edit slds-is-edited'
                );
                break;
            default:
                this.setClassesOnData(dataRecieved.context, '', '');
                break;
        }
        this.updateDraftValues(updatedItem);
        this.updateDataValues(updatedItem);
    }

    updateDataValues(updateItem) {
        let copyData = JSON.parse(JSON.stringify(this.records));
        copyData.forEach((item) => {
            if (item.Id === updateItem.Id) {
                for (let field in updateItem) {
                    item[field] = updateItem[field];
                }
            }
        });
        this.records = [...copyData];
    }

    updateDraftValues(updateItem) {
        let draftValueChanged = false;
        let copyDraftValues = JSON.parse(JSON.stringify(this.draftValues));
        copyDraftValues.forEach((item) => {
            if (item.Id === updateItem.Id) {
                for (let field in updateItem) {
                    item[field] = updateItem[field];
                }
                draftValueChanged = true;
            }
        });
        if (draftValueChanged) {
            this.draftValues = [...copyDraftValues];
        } else {
            this.draftValues = [...copyDraftValues, updateItem];
        }
    }

    handleEdit(event) {
        event.preventDefault();
        let dataRecieved = event.detail.data;
        this.handleWindowOnclick(dataRecieved.context);
        switch (dataRecieved.label) {
            case 'Account':
                this.setClassesOnData(
                    dataRecieved.context,
                    'accountNameClass',
                    'slds-cell-edit'
                );
                break;
            case 'Stage':
                this.setClassesOnData(
                    dataRecieved.context,
                    'stageClass',
                    'slds-cell-edit'
                );
                break;
            default:
                this.setClassesOnData(dataRecieved.context, '', '');
                break;
        };
    }

    setClassesOnData(id, fieldName, fieldValue) {
        this.records = JSON.parse(JSON.stringify(this.records));
        this.records.forEach((detail) => {
            if (detail.Id === id) {
                detail[fieldName] = fieldValue;
            }
        });
    }

    handleSave(event) {
        event.preventDefault();
        this.showSpinner = true;
        saveDraftValues({ data: this.draftValues })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Opportunities updated successfully',
                        variant: 'success'
                    })
                );
                refreshApex(this.wiredRecords).then(() => {
                    this.records.forEach(record => {
                        record.accountNameClass = 'slds-cell-edit';
                        record.stageClass = 'slds-cell-edit';
                    });
                    this.draftValues = [];
                });
            })
            .catch(error => {
                console.log('error : ' + JSON.stringify(error));
                this.showSpinner = false;
            });
    }

//New Opportunity
    handleNewOpportunity(){
        this.newOpportunities = true;
    }

//Row Actions
    handleRowActions(event) {
        let actionName = event.detail.action.name;

        window.console.log('actionName ====> ' + actionName);

        let row = event.detail.row;

        window.console.log('row ====> ' + row);
        // eslint-disable-next-line default-case
        switch (actionName) {
            
            case 'edit':
                this.editOpportunity(row);
                break;
            case 'delete':
                this.deleteOpportunity(row);
                break;
            case 'change_owner':
                this.changeOwnerOpportunity(row);
                break;
        }
    }
    editOpportunity(currentRow){
       
        this.editOpportunities = true;
        this.currentRecordId = currentRow.Id;
    }
    
    closeModal(){
        this.editOpportunities = false;
        this.newOpportunities = false;
        this.changeOwner = false;

    }
    
    handleSubmit(event) {

        console.log('onsubmit event recordEditForm'+ event.detail.fields);  
        event.preventDefault();
        this.template.querySelector('lightning-record-edit-form').submit(event.detail.fields);
        this.closeModal(); 
        console.log('onsuccess event recordEditForm',event.detail.id);
        this.closeModal();
        this.dispatchEvent(new ShowToastEvent({
            title: 'Success!!!',
            message: ' Contact updated',
            variant: 'success'
        })); 
    }
    handleSuccess() {
        
        return refreshApex(this.wiredRecords);
        // Creates the event with the data.
        //const selectedEvent = new CustomEvent("refreshtablechange");
    
        // Dispatches the event.
        //this.dispatchEvent(selectedEvent);
    }

    deleteOpportunity(currentRow) {
        let currentRecord = [];
        currentRecord.push(currentRow.Id);
        this.showSpinner = true;

        deleteOpportunities({opportunitiesIds: currentRecord})
        .then(result => {
            window.console.log('result ====> ' + result);
            this.showSpinner = false;

            
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success!!',
                message: currentRow.FirstName + ' '+ currentRow.LastName +' Contact deleted.',
                variant: 'success'
            }),);

            
             return refreshApex(this.wiredRecords);

        })
        .catch(error => {
            window.console.log('Error ====> '+error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error!!', 
                message: error.message, 
                variant: 'error'
            }),);
        });
    }

    changeOwnerOpportunity(){
        this.changeOwner = true;
    }

    handleEditSomeOpportunities(event){
console.log('==> ',event.detail)
    }

}