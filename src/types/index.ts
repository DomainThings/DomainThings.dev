
export enum DomainAvailabilityStatus {
  NOTAVAILABLE = 0,
  AVAILABLE = 1,
  UNKNOWN = 2
}

export interface IDomain {
  label: string;
  tld: string;
  name: string;
  availabilityStatus?: DomainAvailabilityStatus;
}

export class Domain implements IDomain {
  name: string;
  label: string;
  tld: string;
  availabilityStatus?: DomainAvailabilityStatus | undefined;

  constructor(name: string) {
    const [label = '', tld = ''] = name.split('.');
    this.name = name;
    this.label = label;
    this.tld = tld;
  }

  getFullUrl(): string {
    return 'https://' + this.name
  }

}