public class OpportunityRelatedListController {
	@AuraEnabled(cacheable=true)
    public static List<Opportunity> getRelatedRecords() {
        return [SELECT Id, Name, Account.Name, AccountId, Amount, CloseDate, StageName FROM Opportunity];
    }
    
    @AuraEnabled
    public static void saveDraftValues(Object data) {
        List<Opportunity> listOfOpportunities = (List<Opportunity>) JSON.deserialize(
            JSON.serialize(data),
            List<Opportunity>.class
        );
        update listOfOpportunities;
    }
    @AuraEnabled
    public static void deleteOpportunities(Id [] opportunitiesIds){
        delete [SELECT Id FROM Opportunity where Id = :opportunitiesIds];
    }
}