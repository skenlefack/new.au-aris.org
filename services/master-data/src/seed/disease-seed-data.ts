// Top 30 WOAH-listed diseases critical for Africa

export interface DiseaseSeed {
  code: string;
  nameEn: string;
  nameFr: string;
  isWoahListed: boolean;
  affectedSpecies: string[]; // species codes
  isNotifiable: boolean;
  wahisCategory: string;
}

export const DISEASE_SEEDS: DiseaseSeed[] = [
  { code: 'FMD', nameEn: 'Foot and mouth disease', nameFr: 'Fièvre aphteuse', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'OVI-ARI', 'CAP-HIR', 'SUS-DOM', 'SYN-CAF', 'BUB-BUB'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'CBPP', nameEn: 'Contagious bovine pleuropneumonia', nameFr: 'Péripneumonie contagieuse bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'PPR', nameEn: 'Peste des petits ruminants', nameFr: 'Peste des petits ruminants', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'RVF', nameEn: 'Rift Valley fever', nameFr: 'Fièvre de la Vallée du Rift', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'OVI-ARI', 'CAP-HIR', 'CAM-DRO'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'ASF', nameEn: 'African swine fever', nameFr: 'Peste porcine africaine', isWoahListed: true, affectedSpecies: ['SUS-DOM', 'PHA-AET'], isNotifiable: true, wahisCategory: 'swine' },
  { code: 'HPAI', nameEn: 'Highly pathogenic avian influenza', nameFr: 'Influenza aviaire hautement pathogène', isWoahListed: true, affectedSpecies: ['GAL-DOM', 'ANA-PLA', 'ANS-DOM', 'MEL-GAL', 'NUM-MEL'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'LPAI', nameEn: 'Low pathogenic avian influenza', nameFr: 'Influenza aviaire faiblement pathogène', isWoahListed: true, affectedSpecies: ['GAL-DOM', 'ANA-PLA', 'ANS-DOM'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'NCD', nameEn: 'Newcastle disease', nameFr: 'Maladie de Newcastle', isWoahListed: true, affectedSpecies: ['GAL-DOM', 'MEL-GAL', 'NUM-MEL', 'COL-LIV'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'LSD', nameEn: 'Lumpy skin disease', nameFr: 'Dermatose nodulaire contagieuse', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'SGP', nameEn: 'Sheep pox and goat pox', nameFr: 'Clavelée et variole caprine', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'RAB', nameEn: 'Rabies', nameFr: 'Rage', isWoahListed: true, affectedSpecies: ['CAN-FAM', 'FEL-CAT', 'BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'ANT', nameEn: 'Anthrax', nameFr: 'Fièvre charbonneuse', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'OVI-ARI', 'CAP-HIR', 'EQU-CAB'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'BRU-B', nameEn: 'Brucellosis (Brucella abortus)', nameFr: 'Brucellose (Brucella abortus)', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'BRU-M', nameEn: 'Brucellosis (Brucella melitensis)', nameFr: 'Brucellose (Brucella melitensis)', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'BTB', nameEn: 'Bovine tuberculosis', nameFr: 'Tuberculose bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB', 'SYN-CAF'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'CSF', nameEn: 'Classical swine fever', nameFr: 'Peste porcine classique', isWoahListed: true, affectedSpecies: ['SUS-DOM'], isNotifiable: true, wahisCategory: 'swine' },
  { code: 'ECF', nameEn: 'Theileriosis (East Coast fever)', nameFr: 'Theilériose (fièvre de la côte Est)', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'TRY', nameEn: 'Trypanosomosis (tsetse-transmitted)', nameFr: 'Trypanosomose (transmise par la tsé-tsé)', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'EQU-CAB', 'CAM-DRO'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'BRD', nameEn: 'Bovine viral diarrhoea', nameFr: 'Diarrhée virale bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'IBR', nameEn: 'Infectious bovine rhinotracheitis', nameFr: 'Rhinotrachéite infectieuse bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'HS', nameEn: 'Haemorrhagic septicaemia', nameFr: 'Septicémie hémorragique', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'AHS', nameEn: 'African horse sickness', nameFr: 'Peste équine', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'EQU-ASI', 'EQU-MUL'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'GLN', nameEn: 'Glanders', nameFr: 'Morve', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'EQU-ASI'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'RHD', nameEn: 'Rabbit haemorrhagic disease', nameFr: 'Maladie hémorragique du lapin', isWoahListed: true, affectedSpecies: ['ORC-CUN'], isNotifiable: true, wahisCategory: 'lagomorph' },
  { code: 'MYX', nameEn: 'Myxomatosis', nameFr: 'Myxomatose', isWoahListed: true, affectedSpecies: ['ORC-CUN'], isNotifiable: true, wahisCategory: 'lagomorph' },
  { code: 'VAR', nameEn: 'Varroosis of honey bees', nameFr: 'Varroose des abeilles mellifères', isWoahListed: true, affectedSpecies: ['API-MEL', 'API-ADA', 'API-SCU'], isNotifiable: true, wahisCategory: 'bee' },
  { code: 'AFB', nameEn: 'American foulbrood of honey bees', nameFr: 'Loque américaine des abeilles mellifères', isWoahListed: true, affectedSpecies: ['API-MEL', 'API-ADA', 'API-SCU'], isNotifiable: true, wahisCategory: 'bee' },
  { code: 'SHB', nameEn: 'Small hive beetle infestation', nameFr: 'Infestation par le petit coléoptère', isWoahListed: true, affectedSpecies: ['API-MEL', 'API-ADA', 'API-SCU'], isNotifiable: true, wahisCategory: 'bee' },
  { code: 'EUS', nameEn: 'Epizootic ulcerative syndrome', nameFr: 'Syndrome ulcératif épizootique', isWoahListed: true, affectedSpecies: ['ORE-NIL', 'CLA-GAR'], isNotifiable: true, wahisCategory: 'fish' },
  { code: 'WSSV', nameEn: 'White spot disease', nameFr: 'Maladie des points blancs', isWoahListed: true, affectedSpecies: ['PEN-MON'], isNotifiable: true, wahisCategory: 'crustacean' },
];
