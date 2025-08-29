import type { RdapResponse, RdapBootstrap, RdapService } from '@/types/rdap';

// TODO: move to config
const rdapBootstrapURL: string = 'https://data.iana.org/rdap/dns.json';

let services: RdapService[];

// fetch rdap services
export const getServices = async (): Promise<RdapService[]> => {
  try {
    const rdapBootstrapResponse: Response = await fetch(rdapBootstrapURL);
    if (!rdapBootstrapResponse.ok) {
      const errorMessage: string = await rdapBootstrapResponse.text();
      throw new Error(errorMessage);
    }
    const rdapBootstrapResponseAsJson: RdapBootstrap = await rdapBootstrapResponse.json();
    return rdapBootstrapResponseAsJson.services;

  } catch (error: any) {
    throw new Error(error.message ?? error);
  }
}

// fetch rdap data for a domain
export const fetchRdap = async (domain: string): Promise<RdapResponse> => {
  try {
    if(!services){
      services = await getServices();
    }
    const [_, tld = '.com'] = domain.split('.');

    const service: RdapService | undefined = services.find((service: RdapService) => service[0].includes(tld));
    if (!service || !service[1]|| !service[1][0]) {
      throw new Error(`Unable to find a RDAP provider for ".${tld}" tld`);
    }
    const serviceUrl: string = service[1][0];
    const serviceResponse: Response = await fetch(`${serviceUrl}domain/${domain}`, {
      headers: {
        accept: 'application/rdap+json'
      }
    });
    if (!serviceResponse.ok) {
      const errorMessage: string = await serviceResponse.text();
      throw new Error(`${errorMessage}`);
    }
    const serviceResponseAsJson: RdapResponse = await serviceResponse.json();
    return serviceResponseAsJson;
  } catch (error: any) {
    throw new Error(error.message ?? error);
  }
}

export const getTlds = async (): Promise<string[]> => {
  if(!services){
    services = await getServices();
  }
  return services
    // Extract the TLDs from the first element of each service array
    .flatMap((service: any[]) => service[0]) 
    // Remove leading dots (if any)
    .map((tld: string) => tld.replace(/^\./, "")) 
    // Sort alpha
    .sort((a, b) => a.localeCompare(b));
}

