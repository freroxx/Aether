import { Attachment } from "@/services/shared/attachment";
import { GenericInterface } from "@/services/shared/types";

export interface Chat extends GenericInterface {
  id: string;
  subject: string;
  recipient?: string;
  creator?: string;
  date: Date;
  ref?: any;
}

export interface Recipient {
  id: string;
  name: string;
  class?: string;
  ref?: any;
}

export interface Message {
  id: string;
  content: string;
  author: string;
  subject: string;
  date: Date;
  attachments: Attachment[]
}