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

  // ── Additional WOAH-listed cattle diseases ──
  { code: 'ANA-BOV', nameEn: 'Bovine anaplasmosis', nameFr: 'Anaplasmose bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'BAB-BOV', nameEn: 'Bovine babesiosis', nameFr: 'Babésiose bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'BSE', nameEn: 'Bovine spongiform encephalopathy', nameFr: 'Encéphalopathie spongiforme bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'BEN', nameEn: 'Bovine genital campylobacteriosis', nameFr: 'Campylobactériose génitale bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'TRI-FOE', nameEn: 'Trichomonosis', nameFr: 'Trichomonose', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'ENZ-BOV', nameEn: 'Enzootic bovine leukosis', nameFr: 'Leucose bovine enzootique', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'RPD', nameEn: 'Rinderpest', nameFr: 'Peste bovine', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'BUB-BUB', 'SYN-CAF'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'DER-DIG', nameEn: 'Bovine dermatophilosis', nameFr: 'Dermatophilose bovine', isWoahListed: false, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: false, wahisCategory: 'cattle' },
  { code: 'COW-POX', nameEn: 'Cowdriosis (heartwater)', nameFr: 'Cowdriose (heartwater)', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND', 'OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'multiple_species' },

  // ── Additional small ruminant diseases ──
  { code: 'CCPP', nameEn: 'Contagious caprine pleuropneumonia', nameFr: 'Pleuropneumonie contagieuse caprine', isWoahListed: true, affectedSpecies: ['CAP-HIR'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'OCA', nameEn: 'Ovine chlamydiosis (enzootic abortion)', nameFr: 'Chlamydiose ovine', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'SCR', nameEn: 'Scrapie', nameFr: 'Tremblante du mouton', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'MAE-VIS', nameEn: 'Maedi-visna', nameFr: 'Maedi-visna', isWoahListed: true, affectedSpecies: ['OVI-ARI'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'NAI-SHE', nameEn: 'Nairobi sheep disease', nameFr: 'Maladie de Nairobi', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'BLU', nameEn: 'Bluetongue', nameFr: 'Fièvre catarrhale du mouton', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR', 'BOS-TAU'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'EPI-HEM', nameEn: 'Epizootic haemorrhagic disease', nameFr: 'Maladie hémorragique épizootique', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'multiple_species' },

  // ── Additional swine diseases ──
  { code: 'PED', nameEn: 'Porcine epidemic diarrhoea', nameFr: 'Diarrhée épidémique porcine', isWoahListed: false, affectedSpecies: ['SUS-DOM'], isNotifiable: false, wahisCategory: 'swine' },
  { code: 'PRRS', nameEn: 'Porcine reproductive and respiratory syndrome', nameFr: 'Syndrome reproducteur et respiratoire porcin', isWoahListed: true, affectedSpecies: ['SUS-DOM'], isNotifiable: true, wahisCategory: 'swine' },
  { code: 'AUJ', nameEn: 'Aujeszky\'s disease', nameFr: 'Maladie d\'Aujeszky', isWoahListed: true, affectedSpecies: ['SUS-DOM'], isNotifiable: true, wahisCategory: 'swine' },
  { code: 'TGE', nameEn: 'Transmissible gastroenteritis', nameFr: 'Gastro-entérite transmissible', isWoahListed: true, affectedSpecies: ['SUS-DOM'], isNotifiable: true, wahisCategory: 'swine' },
  { code: 'SWI-EYR', nameEn: 'Swine erysipelas', nameFr: 'Rouget du porc', isWoahListed: false, affectedSpecies: ['SUS-DOM'], isNotifiable: false, wahisCategory: 'swine' },
  { code: 'SWI-INF', nameEn: 'Swine influenza', nameFr: 'Grippe porcine', isWoahListed: true, affectedSpecies: ['SUS-DOM'], isNotifiable: true, wahisCategory: 'swine' },
  { code: 'CYS-SUI', nameEn: 'Porcine cysticercosis', nameFr: 'Cysticercose porcine', isWoahListed: true, affectedSpecies: ['SUS-DOM'], isNotifiable: true, wahisCategory: 'swine' },

  // ── Additional avian diseases ──
  { code: 'IBD', nameEn: 'Infectious bursal disease (Gumboro)', nameFr: 'Maladie de Gumboro', isWoahListed: true, affectedSpecies: ['GAL-DOM'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'AVI-MYC', nameEn: 'Avian mycoplasmosis', nameFr: 'Mycoplasmose aviaire', isWoahListed: true, affectedSpecies: ['GAL-DOM', 'MEL-GAL'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'ILT', nameEn: 'Infectious laryngotracheitis', nameFr: 'Laryngotrachéite infectieuse', isWoahListed: true, affectedSpecies: ['GAL-DOM'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'AVI-POX', nameEn: 'Fowl pox', nameFr: 'Variole aviaire', isWoahListed: true, affectedSpecies: ['GAL-DOM', 'MEL-GAL', 'COL-LIV'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'AVI-CHO', nameEn: 'Fowl cholera', nameFr: 'Choléra aviaire', isWoahListed: true, affectedSpecies: ['GAL-DOM', 'ANA-PLA', 'ANS-DOM', 'MEL-GAL'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'MAR-DIS', nameEn: 'Marek\'s disease', nameFr: 'Maladie de Marek', isWoahListed: true, affectedSpecies: ['GAL-DOM'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'AVI-SAL', nameEn: 'Salmonellosis (pullorum/typhoid)', nameFr: 'Salmonellose aviaire', isWoahListed: true, affectedSpecies: ['GAL-DOM', 'MEL-GAL'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'AVI-TUB', nameEn: 'Avian tuberculosis', nameFr: 'Tuberculose aviaire', isWoahListed: true, affectedSpecies: ['GAL-DOM'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'DUC-VIR', nameEn: 'Duck virus hepatitis', nameFr: 'Hépatite virale du canard', isWoahListed: true, affectedSpecies: ['ANA-PLA'], isNotifiable: true, wahisCategory: 'avian' },
  { code: 'DUC-PLG', nameEn: 'Duck plague (duck virus enteritis)', nameFr: 'Peste du canard', isWoahListed: true, affectedSpecies: ['ANA-PLA', 'ANS-DOM'], isNotifiable: true, wahisCategory: 'avian' },

  // ── Equine diseases ──
  { code: 'EIA', nameEn: 'Equine infectious anaemia', nameFr: 'Anémie infectieuse des équidés', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'EQU-ASI', 'EQU-MUL'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'EHV', nameEn: 'Equine herpesvirus (EHV-1 / EHV-4)', nameFr: 'Herpèsvirose équine', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'EQU-ASI'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'EAV', nameEn: 'Equine viral arteritis', nameFr: 'Artérite virale équine', isWoahListed: true, affectedSpecies: ['EQU-CAB'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'EQU-PIR', nameEn: 'Equine piroplasmosis', nameFr: 'Piroplasmose équine', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'EQU-ASI', 'EQU-MUL'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'SUR-EQU', nameEn: 'Surra (Trypanosoma evansi)', nameFr: 'Surra', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'CAM-DRO', 'BOS-TAU'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'DOU-EQU', nameEn: 'Dourine', nameFr: 'Dourine', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'EQU-ASI'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'VEE', nameEn: 'Venezuelan equine encephalomyelitis', nameFr: 'Encéphalomyélite équine vénézuélienne', isWoahListed: true, affectedSpecies: ['EQU-CAB'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'WNF', nameEn: 'West Nile fever', nameFr: 'Fièvre du Nil occidental', isWoahListed: true, affectedSpecies: ['EQU-CAB', 'GAL-DOM'], isNotifiable: true, wahisCategory: 'multiple_species' },

  // ── Camelid diseases ──
  { code: 'CAM-POX', nameEn: 'Camelpox', nameFr: 'Variole du chameau', isWoahListed: true, affectedSpecies: ['CAM-DRO', 'CAM-BAC'], isNotifiable: true, wahisCategory: 'camelid' },
  { code: 'MERS', nameEn: 'Middle East respiratory syndrome', nameFr: 'Syndrome respiratoire du Moyen-Orient', isWoahListed: false, affectedSpecies: ['CAM-DRO'], isNotifiable: false, wahisCategory: 'camelid' },

  // ── Multi-species / zoonotic diseases ──
  { code: 'DERA', nameEn: 'Dermatophytosis (ringworm)', nameFr: 'Dermatophytose (teigne)', isWoahListed: false, affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR', 'EQU-CAB', 'CAN-FAM', 'FEL-CAT'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'LEP', nameEn: 'Leptospirosis', nameFr: 'Leptospirose', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'SUS-DOM', 'CAN-FAM', 'OVI-ARI'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'QFV', nameEn: 'Q fever (Coxiella burnetii)', nameFr: 'Fièvre Q', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'TUL', nameEn: 'Tularemia', nameFr: 'Tularémie', isWoahListed: true, affectedSpecies: ['ORC-CUN', 'OVI-ARI'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'LEISH', nameEn: 'Leishmaniosis', nameFr: 'Leishmaniose', isWoahListed: true, affectedSpecies: ['CAN-FAM'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'ECH-GRA', nameEn: 'Echinococcosis/hydatidosis', nameFr: 'Échinococcose/hydatidose', isWoahListed: true, affectedSpecies: ['CAN-FAM', 'OVI-ARI', 'BOS-TAU', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'PAR-ASF', nameEn: 'Paratuberculosis (Johne\'s disease)', nameFr: 'Paratuberculose (maladie de Johne)', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'TOX', nameEn: 'Toxoplasmosis', nameFr: 'Toxoplasmose', isWoahListed: false, affectedSpecies: ['FEL-CAT', 'OVI-ARI', 'CAP-HIR'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'CRI-CON', nameEn: 'Crimean-Congo haemorrhagic fever', nameFr: 'Fièvre hémorragique de Crimée-Congo', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'EBO-VIR', nameEn: 'Ebola virus disease (animal)', nameFr: 'Maladie à virus Ebola (animal)', isWoahListed: false, affectedSpecies: ['GOR-GOR', 'PAN-TRO'], isNotifiable: true, wahisCategory: 'wildlife' },
  { code: 'MPX', nameEn: 'Mpox (monkeypox)', nameFr: 'Variole du singe', isWoahListed: false, affectedSpecies: ['PAP-ANU', 'CER-AET', 'CRI-GAM'], isNotifiable: true, wahisCategory: 'wildlife' },

  // ── Aquatic diseases ──
  { code: 'KHV', nameEn: 'Koi herpesvirus disease', nameFr: 'Herpèsvirose de la carpe koï', isWoahListed: true, affectedSpecies: ['CYP-CAR'], isNotifiable: true, wahisCategory: 'fish' },
  { code: 'SVC', nameEn: 'Spring viraemia of carp', nameFr: 'Virémie printanière de la carpe', isWoahListed: true, affectedSpecies: ['CYP-CAR'], isNotifiable: true, wahisCategory: 'fish' },
  { code: 'IHN', nameEn: 'Infectious haematopoietic necrosis', nameFr: 'Nécrose hématopoïétique infectieuse', isWoahListed: true, affectedSpecies: ['ORE-NIL'], isNotifiable: true, wahisCategory: 'fish' },
  { code: 'VHS', nameEn: 'Viral haemorrhagic septicaemia', nameFr: 'Septicémie hémorragique virale', isWoahListed: true, affectedSpecies: ['ORE-NIL', 'CLA-GAR'], isNotifiable: true, wahisCategory: 'fish' },
  { code: 'TIL-VIR', nameEn: 'Tilapia lake virus disease', nameFr: 'Maladie du virus du lac du tilapia', isWoahListed: true, affectedSpecies: ['ORE-NIL', 'ORE-AUR'], isNotifiable: true, wahisCategory: 'fish' },
  { code: 'ISA', nameEn: 'Infectious salmon anaemia', nameFr: 'Anémie infectieuse du saumon', isWoahListed: true, affectedSpecies: [], isNotifiable: true, wahisCategory: 'fish' },

  // ── Bee diseases ──
  { code: 'EFB', nameEn: 'European foulbrood of honey bees', nameFr: 'Loque européenne des abeilles mellifères', isWoahListed: true, affectedSpecies: ['API-MEL', 'API-ADA', 'API-SCU'], isNotifiable: true, wahisCategory: 'bee' },
  { code: 'NOS-BEE', nameEn: 'Nosemosis of honey bees', nameFr: 'Nosémose des abeilles mellifères', isWoahListed: true, affectedSpecies: ['API-MEL', 'API-ADA', 'API-SCU'], isNotifiable: true, wahisCategory: 'bee' },
  { code: 'TRO-BEE', nameEn: 'Tropilaelaps infestation', nameFr: 'Infestation par Tropilaelaps', isWoahListed: true, affectedSpecies: ['API-MEL'], isNotifiable: true, wahisCategory: 'bee' },

  // ── Dog/cat diseases ──
  { code: 'CDV', nameEn: 'Canine distemper', nameFr: 'Maladie de Carré', isWoahListed: false, affectedSpecies: ['CAN-FAM', 'LYC-PIC'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'CPV', nameEn: 'Canine parvovirus', nameFr: 'Parvovirose canine', isWoahListed: false, affectedSpecies: ['CAN-FAM'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'FPV', nameEn: 'Feline panleukopenia', nameFr: 'Panleucopénie féline', isWoahListed: false, affectedSpecies: ['FEL-CAT'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'FIV', nameEn: 'Feline immunodeficiency virus', nameFr: 'Virus de l\'immunodéficience féline', isWoahListed: false, affectedSpecies: ['FEL-CAT'], isNotifiable: false, wahisCategory: 'multiple_species' },

  // ── Wildlife diseases ──
  { code: 'RHDV2', nameEn: 'Rabbit haemorrhagic disease virus 2', nameFr: 'Maladie hémorragique du lapin virus 2', isWoahListed: true, affectedSpecies: ['ORC-CUN'], isNotifiable: true, wahisCategory: 'lagomorph' },
  { code: 'SAR-MNG', nameEn: 'Sarcoptic mange', nameFr: 'Gale sarcoptique', isWoahListed: false, affectedSpecies: ['CAN-FAM', 'SUS-DOM', 'CAM-DRO', 'OVI-ARI'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'ASP-FUM', nameEn: 'Aspergillosis (avian)', nameFr: 'Aspergillose aviaire', isWoahListed: false, affectedSpecies: ['GAL-DOM', 'MEL-GAL', 'PSI-ERY'], isNotifiable: false, wahisCategory: 'avian' },

  // ── Regional/emerging African diseases ──
  { code: 'AHFV', nameEn: 'Alkhurma haemorrhagic fever', nameFr: 'Fièvre hémorragique d\'Alkhurma', isWoahListed: false, affectedSpecies: ['OVI-ARI', 'CAM-DRO'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'WES-EQU', nameEn: 'Western equine encephalitis', nameFr: 'Encéphalite équine de l\'Ouest', isWoahListed: true, affectedSpecies: ['EQU-CAB'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'EAS-EQU', nameEn: 'Eastern equine encephalitis', nameFr: 'Encéphalite équine de l\'Est', isWoahListed: true, affectedSpecies: ['EQU-CAB'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'BRU-SUI', nameEn: 'Brucellosis (Brucella suis)', nameFr: 'Brucellose (Brucella suis)', isWoahListed: true, affectedSpecies: ['SUS-DOM'], isNotifiable: true, wahisCategory: 'swine' },
  { code: 'BRU-OVI', nameEn: 'Brucellosis (Brucella ovis)', nameFr: 'Brucellose (Brucella ovis)', isWoahListed: true, affectedSpecies: ['OVI-ARI'], isNotifiable: true, wahisCategory: 'small_ruminants' },
  { code: 'BRU-CAN', nameEn: 'Brucellosis (Brucella canis)', nameFr: 'Brucellose (Brucella canis)', isWoahListed: true, affectedSpecies: ['CAN-FAM'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'TAE-SAG', nameEn: 'Cysticercosis (Taenia saginata)', nameFr: 'Cysticercose (Taenia saginata)', isWoahListed: true, affectedSpecies: ['BOS-TAU'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'FAS-HEP', nameEn: 'Fasciolosis (liver fluke)', nameFr: 'Fasciolose (douve du foie)', isWoahListed: false, affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'HAE-PAR', nameEn: 'Haemonchosis', nameFr: 'Haemonchose', isWoahListed: false, affectedSpecies: ['OVI-ARI', 'CAP-HIR', 'BOS-TAU'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'THE-PAR', nameEn: 'Tropical theileriosis', nameFr: 'Theilériose tropicale', isWoahListed: true, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: true, wahisCategory: 'cattle' },
  { code: 'PNE-EFB', nameEn: 'Contagious equine metritis', nameFr: 'Métrite contagieuse équine', isWoahListed: true, affectedSpecies: ['EQU-CAB'], isNotifiable: true, wahisCategory: 'equine' },
  { code: 'ACT', nameEn: 'Actinomycosis', nameFr: 'Actinomycose', isWoahListed: false, affectedSpecies: ['BOS-TAU'], isNotifiable: false, wahisCategory: 'cattle' },
  { code: 'BKC', nameEn: 'Bovine keratoconjunctivitis', nameFr: 'Kératoconjonctivite bovine', isWoahListed: false, affectedSpecies: ['BOS-TAU', 'BOS-IND'], isNotifiable: false, wahisCategory: 'cattle' },
  { code: 'CLO-PER', nameEn: 'Enterotoxemia (Clostridium perfringens)', nameFr: 'Entérotoxémie', isWoahListed: false, affectedSpecies: ['OVI-ARI', 'CAP-HIR', 'BOS-TAU'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'BLK-LEG', nameEn: 'Blackleg (Clostridium chauvoei)', nameFr: 'Charbon symptomatique', isWoahListed: false, affectedSpecies: ['BOS-TAU', 'OVI-ARI'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'BOT', nameEn: 'Botulism', nameFr: 'Botulisme', isWoahListed: false, affectedSpecies: ['BOS-TAU', 'EQU-CAB', 'GAL-DOM'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'TET', nameEn: 'Tetanus', nameFr: 'Tétanos', isWoahListed: false, affectedSpecies: ['EQU-CAB', 'OVI-ARI', 'BOS-TAU'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'LIST', nameEn: 'Listeriosis', nameFr: 'Listériose', isWoahListed: true, affectedSpecies: ['OVI-ARI', 'CAP-HIR', 'BOS-TAU'], isNotifiable: true, wahisCategory: 'multiple_species' },
  { code: 'PST-MUL', nameEn: 'Pasteurellosis', nameFr: 'Pasteurellose', isWoahListed: false, affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'BUB-BUB'], isNotifiable: false, wahisCategory: 'multiple_species' },
  { code: 'STR-EQI', nameEn: 'Strangles', nameFr: 'Gourme', isWoahListed: false, affectedSpecies: ['EQU-CAB', 'EQU-ASI'], isNotifiable: false, wahisCategory: 'equine' },
];
