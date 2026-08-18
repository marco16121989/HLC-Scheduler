import { Mongo } from 'meteor/mongo';

export const LinksCollection = new Mongo.Collection('links');

export const HospitalsCollection = new Mongo.Collection("hospitals");
export const DepartmentsCollection = new Mongo.Collection("departments");
export const DoctorsCollection = new Mongo.Collection("doctors");
export const PatientsCollection = new Mongo.Collection("patients");
export const PresentationsCollection = new Mongo.Collection("presentations");
export const SupportRequestsCollection = new Mongo.Collection("supportRequests");
export const NotificationsCollection = new Mongo.Collection("notifications");
export const UsefulFilesCollection = new Mongo.Collection("usefulFiles");
export const AbsencesCollection = new Mongo.Collection("absences");
