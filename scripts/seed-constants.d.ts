/**
 * ARIS 3.0 — Shared Seed Constants
 *
 * Deterministic UUIDs and cross-service references for all domain seeds.
 * These match the values established by tenant, credential, and master-data seeds.
 */
export declare const TENANT_AU_IBAR = "00000000-0000-4000-a000-000000000001";
export declare const TENANT_IGAD = "00000000-0000-4000-a000-000000000010";
export declare const TENANT_KE = "00000000-0000-4000-a000-000000000101";
export declare const USER_SUPER_ADMIN = "10000000-0000-4000-a000-000000000001";
export declare const USER_KE_ADMIN = "10000000-0000-4000-a000-000000000101";
export declare const SPECIES: {
    readonly CATTLE_TAURINE: "BOS-TAU";
    readonly CATTLE_ZEBU: "BOS-IND";
    readonly SHEEP: "OVI-ARI";
    readonly GOAT: "CAP-HIR";
    readonly PIG: "SUS-DOM";
    readonly CHICKEN: "GAL-DOM";
    readonly CAMEL: "CAM-DRO";
    readonly HORSE: "EQU-CAB";
    readonly DONKEY: "EQU-ASI";
    readonly TILAPIA: "ORE-NIL";
    readonly NILE_PERCH: "LAT-NIL";
    readonly TUNA: "THU-ALB";
    readonly PRAWN: "PEN-MON";
    readonly CATFISH: "CLA-GAR";
    readonly ELEPHANT: "LOX-AFR";
    readonly LION: "PAN-LEO";
    readonly RHINO_BLACK: "DIC-BIC";
    readonly RHINO_WHITE: "CER-SIM";
    readonly BUFFALO: "SYN-CAF";
    readonly GIRAFFE: "GIR-CAM";
    readonly HIPPO: "HIP-AMP";
    readonly WILDEBEEST: "CON-TAU";
    readonly WARTHOG: "PHA-AET";
    readonly HONEY_BEE: "API-MEL";
    readonly AFRICAN_BEE: "API-ADA";
    readonly EA_BEE: "API-SCU";
};
export declare const DISEASE: {
    readonly FMD: "FMD";
    readonly PPR: "PPR";
    readonly RVF: "RVF";
    readonly CBPP: "CBPP";
    readonly ASF: "ASF";
    readonly HPAI: "HPAI";
    readonly LSD: "LSD";
    readonly NCD: "NCD";
    readonly BRUCELLOSIS_B: "BRU-B";
    readonly ECF: "ECF";
    readonly VARROOSIS: "VAR";
    readonly NOSEMA: "AFB";
};
export declare const GEO: {
    readonly KENYA: "KE";
    readonly NAIROBI: "KE-30";
    readonly MOMBASA: "KE-01";
    readonly KISUMU: "KE-42";
    readonly NAKURU: "KE-32";
    readonly KIAMBU: "KE-22";
    readonly KILIFI: "KE-03";
    readonly GARISSA: "KE-07";
    readonly MARSABIT: "KE-10";
    readonly MERU: "KE-12";
    readonly UGANDA: "UG";
    readonly TANZANIA: "TZ";
    readonly ETHIOPIA: "ET";
    readonly SOMALIA: "SO";
};
export declare function domainId(domainPrefix: string, seq: number): string;
export declare const PREFIX: {
    readonly ANIMAL_HEALTH: "20000000";
    readonly LIVESTOCK: "21000000";
    readonly FISHERIES: "22000000";
    readonly WILDLIFE: "23000000";
    readonly APICULTURE: "24000000";
    readonly TRADE: "25000000";
    readonly GOVERNANCE: "26000000";
    readonly CLIMATE: "27000000";
    readonly FACILITY: "28000000";
};
export declare const MARKET_NAIROBI: string;
export declare const MARKET_MOMBASA: string;
export declare const MARKET_KISUMU: string;
export declare const FACILITY_DAGORETTI: string;
export declare const FACILITY_ATHI_RIVER: string;
import { PrismaClient } from '@prisma/client';
export interface MasterDataIds {
    species: Map<string, string>;
    diseases: Map<string, string>;
    geoEntities: Map<string, string>;
}
export declare function resolveMasterDataIds(prisma: PrismaClient): Promise<MasterDataIds>;
