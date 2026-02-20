// Top 50+ domestic/wildlife/aquatic/apiculture species

export interface SpeciesSeed {
  code: string;
  scientificName: string;
  commonNameEn: string;
  commonNameFr: string;
  category: 'DOMESTIC' | 'WILDLIFE' | 'AQUATIC' | 'APICULTURE';
  productionCategories: string[];
  isWoahListed: boolean;
}

export const SPECIES_SEEDS: SpeciesSeed[] = [
  // ── Domestic ──
  { code: 'BOS-TAU', scientificName: 'Bos taurus', commonNameEn: 'Cattle (taurine)', commonNameFr: 'Bovin (taurin)', category: 'DOMESTIC', productionCategories: ['dairy', 'beef', 'draught'], isWoahListed: true },
  { code: 'BOS-IND', scientificName: 'Bos indicus', commonNameEn: 'Cattle (zebu)', commonNameFr: 'Bovin (zébu)', category: 'DOMESTIC', productionCategories: ['beef', 'dairy', 'draught'], isWoahListed: true },
  { code: 'OVI-ARI', scientificName: 'Ovis aries', commonNameEn: 'Sheep', commonNameFr: 'Mouton', category: 'DOMESTIC', productionCategories: ['meat', 'wool', 'milk'], isWoahListed: true },
  { code: 'CAP-HIR', scientificName: 'Capra hircus', commonNameEn: 'Goat', commonNameFr: 'Chèvre', category: 'DOMESTIC', productionCategories: ['meat', 'milk', 'fibre'], isWoahListed: true },
  { code: 'SUS-DOM', scientificName: 'Sus domesticus', commonNameEn: 'Pig', commonNameFr: 'Porc', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: true },
  { code: 'GAL-DOM', scientificName: 'Gallus gallus domesticus', commonNameEn: 'Chicken', commonNameFr: 'Poulet', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'MEL-GAL', scientificName: 'Meleagris gallopavo', commonNameEn: 'Turkey', commonNameFr: 'Dinde', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'ANA-PLA', scientificName: 'Anas platyrhynchos domesticus', commonNameEn: 'Duck', commonNameFr: 'Canard', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'ANS-DOM', scientificName: 'Anser anser domesticus', commonNameEn: 'Goose', commonNameFr: 'Oie', category: 'DOMESTIC', productionCategories: ['meat', 'eggs', 'foie gras'], isWoahListed: true },
  { code: 'NUM-MEL', scientificName: 'Numida meleagris', commonNameEn: 'Guinea fowl', commonNameFr: 'Pintade', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'COL-LIV', scientificName: 'Columba livia domestica', commonNameEn: 'Pigeon', commonNameFr: 'Pigeon', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'COT-JAP', scientificName: 'Coturnix japonica', commonNameEn: 'Quail', commonNameFr: 'Caille', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: false },
  { code: 'STR-CAM', scientificName: 'Struthio camelus', commonNameEn: 'Ostrich', commonNameFr: 'Autruche', category: 'DOMESTIC', productionCategories: ['meat', 'eggs', 'leather'], isWoahListed: false },
  { code: 'CAM-DRO', scientificName: 'Camelus dromedarius', commonNameEn: 'Dromedary camel', commonNameFr: 'Dromadaire', category: 'DOMESTIC', productionCategories: ['milk', 'meat', 'transport'], isWoahListed: true },
  { code: 'CAM-BAC', scientificName: 'Camelus bactrianus', commonNameEn: 'Bactrian camel', commonNameFr: 'Chameau de Bactriane', category: 'DOMESTIC', productionCategories: ['milk', 'meat', 'transport'], isWoahListed: false },
  { code: 'EQU-CAB', scientificName: 'Equus caballus', commonNameEn: 'Horse', commonNameFr: 'Cheval', category: 'DOMESTIC', productionCategories: ['transport', 'draught', 'sport'], isWoahListed: true },
  { code: 'EQU-ASI', scientificName: 'Equus asinus', commonNameEn: 'Donkey', commonNameFr: 'Âne', category: 'DOMESTIC', productionCategories: ['transport', 'draught'], isWoahListed: true },
  { code: 'EQU-MUL', scientificName: 'Equus mulus', commonNameEn: 'Mule', commonNameFr: 'Mulet', category: 'DOMESTIC', productionCategories: ['transport', 'draught'], isWoahListed: false },
  { code: 'BUB-BUB', scientificName: 'Bubalus bubalis', commonNameEn: 'Water buffalo', commonNameFr: 'Buffle d\'eau', category: 'DOMESTIC', productionCategories: ['milk', 'meat', 'draught'], isWoahListed: true },
  { code: 'CAN-FAM', scientificName: 'Canis lupus familiaris', commonNameEn: 'Dog', commonNameFr: 'Chien', category: 'DOMESTIC', productionCategories: ['companion', 'herding', 'guard'], isWoahListed: true },
  { code: 'FEL-CAT', scientificName: 'Felis catus', commonNameEn: 'Cat', commonNameFr: 'Chat', category: 'DOMESTIC', productionCategories: ['companion'], isWoahListed: true },
  { code: 'ORC-CUN', scientificName: 'Oryctolagus cuniculus', commonNameEn: 'Rabbit', commonNameFr: 'Lapin', category: 'DOMESTIC', productionCategories: ['meat', 'fur'], isWoahListed: true },
  { code: 'CAV-POR', scientificName: 'Cavia porcellus', commonNameEn: 'Guinea pig', commonNameFr: 'Cochon d\'Inde', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'THR-SWI', scientificName: 'Thryonomys swinderianus', commonNameEn: 'Greater cane rat (grasscutter)', commonNameFr: 'Aulacode', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'CRI-GAM', scientificName: 'Cricetomys gambianus', commonNameEn: 'Gambian pouched rat', commonNameFr: 'Rat de Gambie', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'BOM-MOR', scientificName: 'Bombyx mori', commonNameEn: 'Silkworm', commonNameFr: 'Ver à soie', category: 'DOMESTIC', productionCategories: ['silk'], isWoahListed: false },
  { code: 'ACH-DOM', scientificName: 'Achatina fulica', commonNameEn: 'Giant African snail', commonNameFr: 'Escargot géant d\'Afrique', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'CER-ELA', scientificName: 'Cervus elaphus', commonNameEn: 'Red deer', commonNameFr: 'Cerf élaphe', category: 'DOMESTIC', productionCategories: ['game ranching', 'meat'], isWoahListed: false },
  { code: 'DAM-DAM', scientificName: 'Dama dama', commonNameEn: 'Fallow deer', commonNameFr: 'Daim', category: 'DOMESTIC', productionCategories: ['game ranching', 'meat'], isWoahListed: false },
  { code: 'SUS-SCR', scientificName: 'Sus scrofa', commonNameEn: 'Wild boar', commonNameFr: 'Sanglier', category: 'DOMESTIC', productionCategories: ['game ranching'], isWoahListed: false },
  { code: 'LAM-GLA', scientificName: 'Lama glama', commonNameEn: 'Llama', commonNameFr: 'Lama', category: 'DOMESTIC', productionCategories: ['transport', 'fibre'], isWoahListed: false },
  { code: 'RHE-AME', scientificName: 'Rhea americana', commonNameEn: 'Greater rhea', commonNameFr: 'Nandou d\'Amérique', category: 'DOMESTIC', productionCategories: ['meat', 'eggs', 'leather'], isWoahListed: false },

  // ── Wildlife — Large mammals ──
  { code: 'SYN-CAF', scientificName: 'Syncerus caffer', commonNameEn: 'African buffalo', commonNameFr: 'Buffle d\'Afrique', category: 'WILDLIFE', productionCategories: [], isWoahListed: true },
  { code: 'GIR-CAM', scientificName: 'Giraffa camelopardalis', commonNameEn: 'Giraffe', commonNameFr: 'Girafe', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LOX-AFR', scientificName: 'Loxodonta africana', commonNameEn: 'African elephant', commonNameFr: 'Éléphant d\'Afrique', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LOX-CYC', scientificName: 'Loxodonta cyclotis', commonNameEn: 'African forest elephant', commonNameFr: 'Éléphant de forêt d\'Afrique', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-LEO', scientificName: 'Panthera leo', commonNameEn: 'Lion', commonNameFr: 'Lion', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-PAR', scientificName: 'Panthera pardus', commonNameEn: 'Leopard', commonNameFr: 'Léopard', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ACI-JUB', scientificName: 'Acinonyx jubatus', commonNameEn: 'Cheetah', commonNameFr: 'Guépard', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'DIC-BIC', scientificName: 'Diceros bicornis', commonNameEn: 'Black rhinoceros', commonNameFr: 'Rhinocéros noir', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CER-SIM', scientificName: 'Ceratotherium simum', commonNameEn: 'White rhinoceros', commonNameFr: 'Rhinocéros blanc', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HIP-AMP', scientificName: 'Hippopotamus amphibius', commonNameEn: 'Hippopotamus', commonNameFr: 'Hippopotame', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PHA-AET', scientificName: 'Phacochoerus africanus', commonNameEn: 'Warthog', commonNameFr: 'Phacochère', category: 'WILDLIFE', productionCategories: [], isWoahListed: true },
  { code: 'POT-LAR', scientificName: 'Potamochoerus larvatus', commonNameEn: 'Bushpig', commonNameFr: 'Potamochère', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HYL-MEI', scientificName: 'Hylochoerus meinertzhageni', commonNameEn: 'Giant forest hog', commonNameFr: 'Hylochère', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Antelopes & bovids ──
  { code: 'CON-TAU', scientificName: 'Connochaetes taurinus', commonNameEn: 'Blue wildebeest', commonNameFr: 'Gnou bleu', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CON-GNU', scientificName: 'Connochaetes gnou', commonNameEn: 'Black wildebeest', commonNameFr: 'Gnou noir', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'AEP-MEL', scientificName: 'Aepyceros melampus', commonNameEn: 'Impala', commonNameFr: 'Impala', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ORY-GAZ', scientificName: 'Oryx gazella', commonNameEn: 'Gemsbok', commonNameFr: 'Oryx gazelle', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ORY-BEI', scientificName: 'Oryx beisa', commonNameEn: 'Beisa oryx', commonNameFr: 'Oryx beisa', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-STR', scientificName: 'Tragelaphus strepsiceros', commonNameEn: 'Greater kudu', commonNameFr: 'Grand koudou', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-IMB', scientificName: 'Tragelaphus imberbis', commonNameEn: 'Lesser kudu', commonNameFr: 'Petit koudou', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-ANG', scientificName: 'Tragelaphus angasii', commonNameEn: 'Nyala', commonNameFr: 'Nyala', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-SCR', scientificName: 'Tragelaphus scriptus', commonNameEn: 'Bushbuck', commonNameFr: 'Guib harnaché', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-EUR', scientificName: 'Tragelaphus eurycerus', commonNameEn: 'Bongo', commonNameFr: 'Bongo', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TAU-ORY', scientificName: 'Taurotragus oryx', commonNameEn: 'Common eland', commonNameFr: 'Éland du Cap', category: 'WILDLIFE', productionCategories: ['game ranching'], isWoahListed: false },
  { code: 'TAU-DER', scientificName: 'Taurotragus derbianus', commonNameEn: 'Giant eland', commonNameFr: 'Éland de Derby', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HIP-EQU', scientificName: 'Hippotragus equinus', commonNameEn: 'Roan antelope', commonNameFr: 'Antilope rouanne', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HIP-NIG', scientificName: 'Hippotragus niger', commonNameEn: 'Sable antelope', commonNameFr: 'Hippotrague noir', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ADD-NAS', scientificName: 'Addax nasomaculatus', commonNameEn: 'Addax', commonNameFr: 'Addax', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'KOB-KOB', scientificName: 'Kobus kob', commonNameEn: 'Kob', commonNameFr: 'Cob de Buffon', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'KOB-ELL', scientificName: 'Kobus ellipsiprymnus', commonNameEn: 'Waterbuck', commonNameFr: 'Cobe à croissant', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'RED-RED', scientificName: 'Redunca redunca', commonNameEn: 'Bohor reedbuck', commonNameFr: 'Cobe des roseaux', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ALC-BUS', scientificName: 'Alcelaphus buselaphus', commonNameEn: 'Hartebeest', commonNameFr: 'Bubale', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'DAM-LUN', scientificName: 'Damaliscus lunatus', commonNameEn: 'Tsessebe', commonNameFr: 'Damalisque', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GAZ-THO', scientificName: 'Eudorcas thomsonii', commonNameEn: 'Thomson\'s gazelle', commonNameFr: 'Gazelle de Thomson', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GAZ-GRA', scientificName: 'Nanger granti', commonNameEn: 'Grant\'s gazelle', commonNameFr: 'Gazelle de Grant', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GAZ-DOR', scientificName: 'Gazella dorcas', commonNameEn: 'Dorcas gazelle', commonNameFr: 'Gazelle dorcas', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LIT-WAL', scientificName: 'Litocranius walleri', commonNameEn: 'Gerenuk', commonNameFr: 'Gazelle-girafe', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CEP-SYL', scientificName: 'Sylvicapra grimmia', commonNameEn: 'Common duiker', commonNameFr: 'Céphalophe de Grimm', category: 'WILDLIFE', productionCategories: ['bushmeat'], isWoahListed: false },
  { code: 'CEP-DOR', scientificName: 'Cephalophus dorsalis', commonNameEn: 'Bay duiker', commonNameFr: 'Céphalophe bai', category: 'WILDLIFE', productionCategories: ['bushmeat'], isWoahListed: false },
  { code: 'OUR-OUR', scientificName: 'Ourebia ourebi', commonNameEn: 'Oribi', commonNameFr: 'Ourébi', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Zebras ──
  { code: 'EQU-QUA', scientificName: 'Equus quagga', commonNameEn: 'Plains zebra', commonNameFr: 'Zèbre de plaine', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'EQU-GRE', scientificName: 'Equus grevyi', commonNameEn: 'Grevy\'s zebra', commonNameFr: 'Zèbre de Grévy', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Primates ──
  { code: 'GOR-GOR', scientificName: 'Gorilla gorilla', commonNameEn: 'Western gorilla', commonNameFr: 'Gorille de l\'Ouest', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GOR-BER', scientificName: 'Gorilla beringei', commonNameEn: 'Eastern gorilla', commonNameFr: 'Gorille de l\'Est', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-TRO', scientificName: 'Pan troglodytes', commonNameEn: 'Common chimpanzee', commonNameFr: 'Chimpanzé commun', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-PAN', scientificName: 'Pan paniscus', commonNameEn: 'Bonobo', commonNameFr: 'Bonobo', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAP-ANU', scientificName: 'Papio anubis', commonNameEn: 'Olive baboon', commonNameFr: 'Babouin olive', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CER-AET', scientificName: 'Chlorocebus aethiops', commonNameEn: 'Vervet monkey', commonNameFr: 'Vervet', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'COL-GUE', scientificName: 'Colobus guereza', commonNameEn: 'Guereza colobus', commonNameFr: 'Colobe guéréza', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Carnivores ──
  { code: 'CRO-CRO', scientificName: 'Crocuta crocuta', commonNameEn: 'Spotted hyena', commonNameFr: 'Hyène tachetée', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LYC-PIC', scientificName: 'Lycaon pictus', commonNameEn: 'African wild dog', commonNameFr: 'Lycaon', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CAN-MES', scientificName: 'Canis mesomelas', commonNameEn: 'Black-backed jackal', commonNameFr: 'Chacal à chabraque', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'VUL-VUL', scientificName: 'Vulpes vulpes', commonNameEn: 'Red fox', commonNameFr: 'Renard roux', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'OTO-MEG', scientificName: 'Otocyon megalotis', commonNameEn: 'Bat-eared fox', commonNameFr: 'Otocyon', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CIV-CIV', scientificName: 'Civettictis civetta', commonNameEn: 'African civet', commonNameFr: 'Civette d\'Afrique', category: 'WILDLIFE', productionCategories: ['musk'], isWoahListed: false },
  { code: 'GEN-GEN', scientificName: 'Genetta genetta', commonNameEn: 'Common genet', commonNameFr: 'Genette commune', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'MEL-CAP', scientificName: 'Mellivora capensis', commonNameEn: 'Honey badger', commonNameFr: 'Ratel', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Reptiles ──
  { code: 'CRO-NIL', scientificName: 'Crocodylus niloticus', commonNameEn: 'Nile crocodile', commonNameFr: 'Crocodile du Nil', category: 'WILDLIFE', productionCategories: ['leather', 'ranching'], isWoahListed: false },
  { code: 'VAR-NIL', scientificName: 'Varanus niloticus', commonNameEn: 'Nile monitor', commonNameFr: 'Varan du Nil', category: 'WILDLIFE', productionCategories: ['leather'], isWoahListed: false },
  { code: 'PYT-SEB', scientificName: 'Python sebae', commonNameEn: 'African rock python', commonNameFr: 'Python de Seba', category: 'WILDLIFE', productionCategories: ['leather'], isWoahListed: false },
  { code: 'CHE-PAR', scientificName: 'Chelonia mydas', commonNameEn: 'Green sea turtle', commonNameFr: 'Tortue verte', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'DER-COR', scientificName: 'Dermochelys coriacea', commonNameEn: 'Leatherback sea turtle', commonNameFr: 'Tortue luth', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Birds (wild) ──
  { code: 'BAL-PAV', scientificName: 'Balearica pavonina', commonNameEn: 'Black crowned crane', commonNameFr: 'Grue couronnée noire', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'BAL-REG', scientificName: 'Balearica regulorum', commonNameEn: 'Grey crowned crane', commonNameFr: 'Grue royale', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'SAG-SER', scientificName: 'Sagittarius serpentarius', commonNameEn: 'Secretary bird', commonNameFr: 'Messager sagittaire', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GYP-AFR', scientificName: 'Gyps africanus', commonNameEn: 'White-backed vulture', commonNameFr: 'Vautour africain', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PHO-RUB', scientificName: 'Phoenicopterus roseus', commonNameEn: 'Greater flamingo', commonNameFr: 'Flamant rose', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PHO-MIN', scientificName: 'Phoeniconaias minor', commonNameEn: 'Lesser flamingo', commonNameFr: 'Flamant nain', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PEL-ONO', scientificName: 'Pelecanus onocrotalus', commonNameEn: 'Great white pelican', commonNameFr: 'Pélican blanc', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PSI-ERY', scientificName: 'Psittacus erithacus', commonNameEn: 'African grey parrot', commonNameFr: 'Perroquet jaco', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Aquatic — Freshwater fish ──
  { code: 'ORE-NIL', scientificName: 'Oreochromis niloticus', commonNameEn: 'Nile tilapia', commonNameFr: 'Tilapia du Nil', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: true },
  { code: 'ORE-AUR', scientificName: 'Oreochromis aureus', commonNameEn: 'Blue tilapia', commonNameFr: 'Tilapia bleu', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false },
  { code: 'ORE-MOS', scientificName: 'Oreochromis mossambicus', commonNameEn: 'Mozambique tilapia', commonNameFr: 'Tilapia du Mozambique', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false },
  { code: 'TIL-ZIL', scientificName: 'Tilapia zillii', commonNameEn: 'Redbelly tilapia', commonNameFr: 'Tilapia de Zill', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: false },
  { code: 'CLA-GAR', scientificName: 'Clarias gariepinus', commonNameEn: 'African catfish', commonNameFr: 'Poisson-chat africain', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: false },
  { code: 'HET-LON', scientificName: 'Heterobranchus longifilis', commonNameEn: 'African catfish (longfin)', commonNameFr: 'Silure africain', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false },
  { code: 'LAT-NIL', scientificName: 'Lates niloticus', commonNameEn: 'Nile perch', commonNameFr: 'Perche du Nil', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'LAB-COU', scientificName: 'Labeo coubie', commonNameEn: 'African carp', commonNameFr: 'Carpe africaine', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'BAG-BAY', scientificName: 'Bagrus bayad', commonNameEn: 'Bayad', commonNameFr: 'Machoiron', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'GYM-NIL', scientificName: 'Gymnarchus niloticus', commonNameEn: 'Aba aba', commonNameFr: 'Poisson-cheval', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'MOR-RUM', scientificName: 'Mormyrus rume', commonNameEn: 'Mormyrid', commonNameFr: 'Mormyre', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'CYP-CAR', scientificName: 'Cyprinus carpio', commonNameEn: 'Common carp', commonNameFr: 'Carpe commune', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false },
  { code: 'PRO-NIL', scientificName: 'Protopterus annectens', commonNameEn: 'West African lungfish', commonNameFr: 'Protoptère', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },

  // ── Aquatic — Marine fish ──
  { code: 'SAR-PIL', scientificName: 'Sardina pilchardus', commonNameEn: 'European pilchard', commonNameFr: 'Sardine', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'SAR-AUR', scientificName: 'Sardinella aurita', commonNameEn: 'Round sardinella', commonNameFr: 'Sardinelle ronde', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'SAR-MAD', scientificName: 'Sardinella maderensis', commonNameEn: 'Flat sardinella', commonNameFr: 'Sardinelle plate', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'THU-ALB', scientificName: 'Thunnus albacares', commonNameEn: 'Yellowfin tuna', commonNameFr: 'Albacore', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'THU-OBE', scientificName: 'Thunnus obesus', commonNameEn: 'Bigeye tuna', commonNameFr: 'Thon obèse', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'KAT-PEL', scientificName: 'Katsuwonus pelamis', commonNameEn: 'Skipjack tuna', commonNameFr: 'Bonite à ventre rayé', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'XIP-GLA', scientificName: 'Xiphias gladius', commonNameEn: 'Swordfish', commonNameFr: 'Espadon', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'SCO-JAP', scientificName: 'Scomber japonicus', commonNameEn: 'Chub mackerel', commonNameFr: 'Maquereau espagnol', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'TRA-TRA', scientificName: 'Trachurus trachurus', commonNameEn: 'Horse mackerel', commonNameFr: 'Chinchard commun', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'MER-MER', scientificName: 'Merluccius merluccius', commonNameEn: 'Hake', commonNameFr: 'Merlu commun', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'DEN-MAC', scientificName: 'Dentex macrophthalmus', commonNameEn: 'Large-eye dentex', commonNameFr: 'Denté à gros yeux', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'PAG-PAG', scientificName: 'Pagellus bellottii', commonNameEn: 'Red pandora', commonNameFr: 'Pageot rouge', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'EPH-AEN', scientificName: 'Epinephelus aeneus', commonNameEn: 'White grouper', commonNameFr: 'Mérou blanc', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'PSE-SEN', scientificName: 'Pseudotolithus senegalensis', commonNameEn: 'Cassava croaker', commonNameFr: 'Otolithe du Sénégal', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'ETH-FIM', scientificName: 'Ethmalosa fimbriata', commonNameEn: 'Bonga shad', commonNameFr: 'Ethmalose', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },

  // ── Aquatic — Crustaceans & molluscs ──
  { code: 'PEN-MON', scientificName: 'Penaeus monodon', commonNameEn: 'Giant tiger prawn', commonNameFr: 'Crevette géante tigrée', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: true },
  { code: 'PEN-VAN', scientificName: 'Litopenaeus vannamei', commonNameEn: 'Whiteleg shrimp', commonNameFr: 'Crevette à pattes blanches', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false },
  { code: 'PAN-HOM', scientificName: 'Panulirus homarus', commonNameEn: 'Scalloped spiny lobster', commonNameFr: 'Langouste festonnée', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'CRA-CRA', scientificName: 'Crassostrea gigas', commonNameEn: 'Pacific oyster', commonNameFr: 'Huître creuse', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: true },
  { code: 'MYT-GAL', scientificName: 'Mytilus galloprovincialis', commonNameEn: 'Mediterranean mussel', commonNameFr: 'Moule méditerranéenne', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false },
  { code: 'OCT-VUL', scientificName: 'Octopus vulgaris', commonNameEn: 'Common octopus', commonNameFr: 'Poulpe commun', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'SEP-OFF', scientificName: 'Sepia officinalis', commonNameEn: 'Common cuttlefish', commonNameFr: 'Seiche commune', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },

  // ── Aquatic — Marine mammals ──
  { code: 'TUR-TRU', scientificName: 'Tursiops truncatus', commonNameEn: 'Bottlenose dolphin', commonNameFr: 'Grand dauphin', category: 'AQUATIC', productionCategories: [], isWoahListed: false },
  { code: 'DUG-DUG', scientificName: 'Dugong dugon', commonNameEn: 'Dugong', commonNameFr: 'Dugong', category: 'AQUATIC', productionCategories: [], isWoahListed: false },
  { code: 'TRI-MAN', scientificName: 'Trichechus senegalensis', commonNameEn: 'African manatee', commonNameFr: 'Lamantin d\'Afrique', category: 'AQUATIC', productionCategories: [], isWoahListed: false },

  // ── Apiculture ──
  { code: 'API-MEL', scientificName: 'Apis mellifera', commonNameEn: 'Western honey bee', commonNameFr: 'Abeille domestique', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'API-ADA', scientificName: 'Apis mellifera adansonii', commonNameEn: 'African honey bee', commonNameFr: 'Abeille africaine', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'API-SCU', scientificName: 'Apis mellifera scutellata', commonNameEn: 'East African lowland honey bee', commonNameFr: 'Abeille de plaine est-africaine', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'MEL-BEE', scientificName: 'Meliponini spp.', commonNameEn: 'Stingless bee', commonNameFr: 'Abeille sans dard', category: 'APICULTURE', productionCategories: ['honey', 'pollination'], isWoahListed: false },
];
