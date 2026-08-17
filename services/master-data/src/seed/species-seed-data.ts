// Top 50+ domestic/wildlife/aquatic/apiculture species

export interface SpeciesSeed {
  code: string;
  scientificName: string;
  commonNameEn: string;
  commonNameFr: string;
  commonNamePt: string;
  commonNameAr: string;
  category: 'DOMESTIC' | 'WILDLIFE' | 'AQUATIC' | 'APICULTURE';
  productionCategories: string[];
  isWoahListed: boolean;
  faoAlphaCode?: string;
}

export const SPECIES_SEEDS: SpeciesSeed[] = [
  // ── Domestic ──
  { code: 'BOS-TAU', scientificName: 'Bos taurus', commonNameEn: 'Cattle (taurine)', commonNameFr: 'Bovin (taurin)', commonNamePt: 'Bovino (taurino)', commonNameAr: 'أبقار (تورين)', category: 'DOMESTIC', productionCategories: ['dairy', 'beef', 'draught'], isWoahListed: true },
  { code: 'BOS-IND', scientificName: 'Bos indicus', commonNameEn: 'Cattle (zebu)', commonNameFr: 'Bovin (zébu)', commonNamePt: 'Bovino (zebu)', commonNameAr: 'أبقار (زيبو)', category: 'DOMESTIC', productionCategories: ['beef', 'dairy', 'draught'], isWoahListed: true },
  { code: 'OVI-ARI', scientificName: 'Ovis aries', commonNameEn: 'Sheep', commonNameFr: 'Mouton', commonNamePt: 'Ovelha', commonNameAr: 'أغنام', category: 'DOMESTIC', productionCategories: ['meat', 'wool', 'milk'], isWoahListed: true },
  { code: 'CAP-HIR', scientificName: 'Capra hircus', commonNameEn: 'Goat', commonNameFr: 'Chèvre', commonNamePt: 'Cabra', commonNameAr: 'ماعز', category: 'DOMESTIC', productionCategories: ['meat', 'milk', 'fibre'], isWoahListed: true },
  { code: 'SUS-DOM', scientificName: 'Sus domesticus', commonNameEn: 'Pig', commonNameFr: 'Porc', commonNamePt: 'Porco', commonNameAr: 'خنازير', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: true },
  { code: 'GAL-DOM', scientificName: 'Gallus gallus domesticus', commonNameEn: 'Chicken', commonNameFr: 'Poulet', commonNamePt: 'Frango', commonNameAr: 'دجاج', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'MEL-GAL', scientificName: 'Meleagris gallopavo', commonNameEn: 'Turkey', commonNameFr: 'Dinde', commonNamePt: 'Peru', commonNameAr: 'ديك رومي', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'ANA-PLA', scientificName: 'Anas platyrhynchos domesticus', commonNameEn: 'Duck', commonNameFr: 'Canard', commonNamePt: 'Pato', commonNameAr: 'بط', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'ANS-DOM', scientificName: 'Anser anser domesticus', commonNameEn: 'Goose', commonNameFr: 'Oie', commonNamePt: 'Ganso', commonNameAr: 'إوز', category: 'DOMESTIC', productionCategories: ['meat', 'eggs', 'foie gras'], isWoahListed: true },
  { code: 'NUM-MEL', scientificName: 'Numida meleagris', commonNameEn: 'Guinea fowl', commonNameFr: 'Pintade', commonNamePt: 'Galinha-d\'angola', commonNameAr: 'دجاج غينيا', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: true },
  { code: 'COL-LIV', scientificName: 'Columba livia domestica', commonNameEn: 'Pigeon', commonNameFr: 'Pigeon', commonNamePt: 'Pombo', commonNameAr: 'حمام', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'COT-JAP', scientificName: 'Coturnix japonica', commonNameEn: 'Quail', commonNameFr: 'Caille', commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['meat', 'eggs'], isWoahListed: false },
  { code: 'STR-CAM', scientificName: 'Struthio camelus', commonNameEn: 'Ostrich', commonNameFr: 'Autruche', commonNamePt: 'Avestruz', commonNameAr: 'نعام', category: 'DOMESTIC', productionCategories: ['meat', 'eggs', 'leather'], isWoahListed: false },
  { code: 'CAM-DRO', scientificName: 'Camelus dromedarius', commonNameEn: 'Dromedary camel', commonNameFr: 'Dromadaire', commonNamePt: 'Dromedário', commonNameAr: 'جمل عربي', category: 'DOMESTIC', productionCategories: ['milk', 'meat', 'transport'], isWoahListed: true },
  { code: 'CAM-BAC', scientificName: 'Camelus bactrianus', commonNameEn: 'Bactrian camel', commonNameFr: 'Chameau de Bactriane', commonNamePt: 'Camelo bactriano', commonNameAr: 'جمل ذو سنامين', category: 'DOMESTIC', productionCategories: ['milk', 'meat', 'transport'], isWoahListed: false },
  { code: 'EQU-CAB', scientificName: 'Equus caballus', commonNameEn: 'Horse', commonNameFr: 'Cheval', commonNamePt: 'Cavalo', commonNameAr: 'حصان', category: 'DOMESTIC', productionCategories: ['transport', 'draught', 'sport'], isWoahListed: true },
  { code: 'EQU-ASI', scientificName: 'Equus asinus', commonNameEn: 'Donkey', commonNameFr: 'Âne', commonNamePt: 'Burro', commonNameAr: 'حمار', category: 'DOMESTIC', productionCategories: ['transport', 'draught'], isWoahListed: true },
  { code: 'EQU-MUL', scientificName: 'Equus mulus', commonNameEn: 'Mule', commonNameFr: 'Mulet', commonNamePt: 'Mula', commonNameAr: 'بغل', category: 'DOMESTIC', productionCategories: ['transport', 'draught'], isWoahListed: false },
  { code: 'BUB-BUB', scientificName: 'Bubalus bubalis', commonNameEn: 'Water buffalo', commonNameFr: "Buffle d'eau", commonNamePt: 'Búfalo', commonNameAr: 'جاموس', category: 'DOMESTIC', productionCategories: ['milk', 'meat', 'draught'], isWoahListed: true },
  { code: 'CAN-FAM', scientificName: 'Canis lupus familiaris', commonNameEn: 'Dog', commonNameFr: 'Chien', commonNamePt: 'Cão', commonNameAr: 'كلب', category: 'DOMESTIC', productionCategories: ['companion', 'herding', 'guard'], isWoahListed: true },
  { code: 'FEL-CAT', scientificName: 'Felis catus', commonNameEn: 'Cat', commonNameFr: 'Chat', commonNamePt: 'Gato', commonNameAr: 'قط', category: 'DOMESTIC', productionCategories: ['companion'], isWoahListed: true },
  { code: 'ORC-CUN', scientificName: 'Oryctolagus cuniculus', commonNameEn: 'Rabbit', commonNameFr: 'Lapin', commonNamePt: 'Coelho', commonNameAr: 'أرنب', category: 'DOMESTIC', productionCategories: ['meat', 'fur'], isWoahListed: true },
  { code: 'CAV-POR', scientificName: 'Cavia porcellus', commonNameEn: 'Guinea pig', commonNameFr: "Cochon d'Inde", commonNamePt: 'Porquinho-da-índia', commonNameAr: 'خنزير غينيا', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'THR-SWI', scientificName: 'Thryonomys swinderianus', commonNameEn: 'Greater cane rat (grasscutter)', commonNameFr: 'Aulacode', commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'CRI-GAM', scientificName: 'Cricetomys gambianus', commonNameEn: 'Gambian pouched rat', commonNameFr: 'Rat de Gambie', commonNamePt: 'Rato-da-gâmbia', commonNameAr: 'فأر غامبيا', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'BOM-MOR', scientificName: 'Bombyx mori', commonNameEn: 'Silkworm', commonNameFr: 'Ver à soie', commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['silk'], isWoahListed: false },
  { code: 'ACH-DOM', scientificName: 'Achatina fulica', commonNameEn: 'Giant African snail', commonNameFr: "Escargot géant d'Afrique", commonNamePt: 'Caracol gigante africano', commonNameAr: 'حلزون أفريقي عملاق', category: 'DOMESTIC', productionCategories: ['meat'], isWoahListed: false },
  { code: 'CER-ELA', scientificName: 'Cervus elaphus', commonNameEn: 'Red deer', commonNameFr: 'Cerf élaphe', commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['game ranching', 'meat'], isWoahListed: false },
  { code: 'DAM-DAM', scientificName: 'Dama dama', commonNameEn: 'Fallow deer', commonNameFr: 'Daim', commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['game ranching', 'meat'], isWoahListed: false },
  { code: 'SUS-SCR', scientificName: 'Sus scrofa', commonNameEn: 'Wild boar', commonNameFr: 'Sanglier', commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['game ranching'], isWoahListed: false },
  { code: 'LAM-GLA', scientificName: 'Lama glama', commonNameEn: 'Llama', commonNameFr: 'Lama', commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['transport', 'fibre'], isWoahListed: false },
  { code: 'RHE-AME', scientificName: 'Rhea americana', commonNameEn: 'Greater rhea', commonNameFr: "Nandou d'Amérique", commonNamePt: '', commonNameAr: '', category: 'DOMESTIC', productionCategories: ['meat', 'eggs', 'leather'], isWoahListed: false },

  // ── Wildlife — Large mammals ──
  { code: 'SYN-CAF', scientificName: 'Syncerus caffer', commonNameEn: 'African buffalo', commonNameFr: "Buffle d'Afrique", commonNamePt: 'Búfalo-africano', commonNameAr: 'جاموس أفريقي', category: 'WILDLIFE', productionCategories: [], isWoahListed: true },
  { code: 'GIR-CAM', scientificName: 'Giraffa camelopardalis', commonNameEn: 'Giraffe', commonNameFr: 'Girafe', commonNamePt: 'Girafa', commonNameAr: 'زرافة', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LOX-AFR', scientificName: 'Loxodonta africana', commonNameEn: 'African elephant', commonNameFr: "Éléphant d'Afrique", commonNamePt: 'Elefante africano', commonNameAr: 'فيل أفريقي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LOX-CYC', scientificName: 'Loxodonta cyclotis', commonNameEn: 'African forest elephant', commonNameFr: "Éléphant de forêt d'Afrique", commonNamePt: 'Elefante-da-floresta', commonNameAr: 'فيل الغابات الأفريقي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-LEO', scientificName: 'Panthera leo', commonNameEn: 'Lion', commonNameFr: 'Lion', commonNamePt: 'Leão', commonNameAr: 'أسد', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-PAR', scientificName: 'Panthera pardus', commonNameEn: 'Leopard', commonNameFr: 'Léopard', commonNamePt: 'Leopardo', commonNameAr: 'فهد', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ACI-JUB', scientificName: 'Acinonyx jubatus', commonNameEn: 'Cheetah', commonNameFr: 'Guépard', commonNamePt: 'Chita', commonNameAr: 'فهد صياد', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'DIC-BIC', scientificName: 'Diceros bicornis', commonNameEn: 'Black rhinoceros', commonNameFr: 'Rhinocéros noir', commonNamePt: 'Rinoceronte negro', commonNameAr: 'وحيد القرن الأسود', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CER-SIM', scientificName: 'Ceratotherium simum', commonNameEn: 'White rhinoceros', commonNameFr: 'Rhinocéros blanc', commonNamePt: 'Rinoceronte branco', commonNameAr: 'وحيد القرن الأبيض', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HIP-AMP', scientificName: 'Hippopotamus amphibius', commonNameEn: 'Hippopotamus', commonNameFr: 'Hippopotame', commonNamePt: 'Hipopótamo', commonNameAr: 'فرس النهر', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PHA-AET', scientificName: 'Phacochoerus africanus', commonNameEn: 'Warthog', commonNameFr: 'Phacochère', commonNamePt: 'Facóquero', commonNameAr: 'خنزير أفريقي', category: 'WILDLIFE', productionCategories: [], isWoahListed: true },
  { code: 'POT-LAR', scientificName: 'Potamochoerus larvatus', commonNameEn: 'Bushpig', commonNameFr: 'Potamochère', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HYL-MEI', scientificName: 'Hylochoerus meinertzhageni', commonNameEn: 'Giant forest hog', commonNameFr: 'Hylochère', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Antelopes & bovids ──
  { code: 'CON-TAU', scientificName: 'Connochaetes taurinus', commonNameEn: 'Blue wildebeest', commonNameFr: 'Gnou bleu', commonNamePt: 'Gnu', commonNameAr: 'نو أزرق', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CON-GNU', scientificName: 'Connochaetes gnou', commonNameEn: 'Black wildebeest', commonNameFr: 'Gnou noir', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'AEP-MEL', scientificName: 'Aepyceros melampus', commonNameEn: 'Impala', commonNameFr: 'Impala', commonNamePt: 'Impala', commonNameAr: 'إمبالا', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ORY-GAZ', scientificName: 'Oryx gazella', commonNameEn: 'Gemsbok', commonNameFr: 'Oryx gazelle', commonNamePt: 'Órix', commonNameAr: 'مها', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ORY-BEI', scientificName: 'Oryx beisa', commonNameEn: 'Beisa oryx', commonNameFr: 'Oryx beisa', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-STR', scientificName: 'Tragelaphus strepsiceros', commonNameEn: 'Greater kudu', commonNameFr: 'Grand koudou', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-IMB', scientificName: 'Tragelaphus imberbis', commonNameEn: 'Lesser kudu', commonNameFr: 'Petit koudou', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-ANG', scientificName: 'Tragelaphus angasii', commonNameEn: 'Nyala', commonNameFr: 'Nyala', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-SCR', scientificName: 'Tragelaphus scriptus', commonNameEn: 'Bushbuck', commonNameFr: 'Guib harnaché', commonNamePt: 'Elande', commonNameAr: 'إيلاند', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-EUR', scientificName: 'Tragelaphus eurycerus', commonNameEn: 'Bongo', commonNameFr: 'Bongo', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TAU-ORY', scientificName: 'Taurotragus oryx', commonNameEn: 'Common eland', commonNameFr: 'Éland du Cap', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: ['game ranching'], isWoahListed: false },
  { code: 'TAU-DER', scientificName: 'Taurotragus derbianus', commonNameEn: 'Giant eland', commonNameFr: 'Éland de Derby', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HIP-EQU', scientificName: 'Hippotragus equinus', commonNameEn: 'Roan antelope', commonNameFr: 'Antilope rouanne', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HIP-NIG', scientificName: 'Hippotragus niger', commonNameEn: 'Sable antelope', commonNameFr: 'Hippotrague noir', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ADD-NAS', scientificName: 'Addax nasomaculatus', commonNameEn: 'Addax', commonNameFr: 'Addax', commonNamePt: 'Adax', commonNameAr: 'المها أبو عدس', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'KOB-KOB', scientificName: 'Kobus kob', commonNameEn: 'Kob', commonNameFr: 'Cob de Buffon', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'KOB-ELL', scientificName: 'Kobus ellipsiprymnus', commonNameEn: 'Waterbuck', commonNameFr: 'Cobe à croissant', commonNamePt: 'Antílope-aquático', commonNameAr: 'ظبي مائي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'RED-RED', scientificName: 'Redunca redunca', commonNameEn: 'Bohor reedbuck', commonNameFr: 'Cobe des roseaux', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ALC-BUS', scientificName: 'Alcelaphus buselaphus', commonNameEn: 'Hartebeest', commonNameFr: 'Bubale', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'DAM-LUN', scientificName: 'Damaliscus lunatus', commonNameEn: 'Tsessebe', commonNameFr: 'Damalisque', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GAZ-THO', scientificName: 'Eudorcas thomsonii', commonNameEn: 'Thomson\'s gazelle', commonNameFr: 'Gazelle de Thomson', commonNamePt: 'Gazela-de-thomson', commonNameAr: 'غزال طومسون', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GAZ-GRA', scientificName: 'Nanger granti', commonNameEn: 'Grant\'s gazelle', commonNameFr: 'Gazelle de Grant', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GAZ-DOR', scientificName: 'Gazella dorcas', commonNameEn: 'Dorcas gazelle', commonNameFr: 'Gazelle dorcas', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LIT-WAL', scientificName: 'Litocranius walleri', commonNameEn: 'Gerenuk', commonNameFr: 'Gazelle-girafe', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CEP-SYL', scientificName: 'Sylvicapra grimmia', commonNameEn: 'Common duiker', commonNameFr: 'Céphalophe de Grimm', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: ['bushmeat'], isWoahListed: false },
  { code: 'CEP-DOR', scientificName: 'Cephalophus dorsalis', commonNameEn: 'Bay duiker', commonNameFr: 'Céphalophe bai', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: ['bushmeat'], isWoahListed: false },
  { code: 'OUR-OUR', scientificName: 'Ourebia ourebi', commonNameEn: 'Oribi', commonNameFr: 'Ourébi', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Zebras ──
  { code: 'EQU-QUA', scientificName: 'Equus quagga', commonNameEn: 'Plains zebra', commonNameFr: 'Zèbre de plaine', commonNamePt: 'Zebra-da-planície', commonNameAr: 'حمار وحشي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'EQU-GRE', scientificName: 'Equus grevyi', commonNameEn: 'Grevy\'s zebra', commonNameFr: 'Zèbre de Grévy', commonNamePt: 'Zebra-de-grevy', commonNameAr: 'حمار وحشي جريفي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Primates ──
  { code: 'GOR-GOR', scientificName: 'Gorilla gorilla', commonNameEn: 'Western gorilla', commonNameFr: "Gorille de l'Ouest", commonNamePt: 'Gorila', commonNameAr: 'غوريلا', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GOR-BER', scientificName: 'Gorilla beringei', commonNameEn: 'Eastern gorilla', commonNameFr: "Gorille de l'Est", commonNamePt: 'Gorila-das-montanhas', commonNameAr: 'غوريلا جبلي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-TRO', scientificName: 'Pan troglodytes', commonNameEn: 'Common chimpanzee', commonNameFr: 'Chimpanzé commun', commonNamePt: 'Chimpanzé', commonNameAr: 'شمبانزي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-PAN', scientificName: 'Pan paniscus', commonNameEn: 'Bonobo', commonNameFr: 'Bonobo', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAP-ANU', scientificName: 'Papio anubis', commonNameEn: 'Olive baboon', commonNameFr: 'Babouin olive', commonNamePt: 'Babuíno', commonNameAr: 'قرد البابون', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CER-AET', scientificName: 'Chlorocebus aethiops', commonNameEn: 'Vervet monkey', commonNameFr: 'Vervet', commonNamePt: 'Macaco-verde', commonNameAr: 'قرد أخضر', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'COL-GUE', scientificName: 'Colobus guereza', commonNameEn: 'Guereza colobus', commonNameFr: 'Colobe guéréza', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Carnivores ──
  { code: 'CRO-CRO', scientificName: 'Crocuta crocuta', commonNameEn: 'Spotted hyena', commonNameFr: 'Hyène tachetée', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LYC-PIC', scientificName: 'Lycaon pictus', commonNameEn: 'African wild dog', commonNameFr: 'Lycaon', commonNamePt: 'Cão-selvagem-africano', commonNameAr: 'كلب بري أفريقي', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CAN-MES', scientificName: 'Canis mesomelas', commonNameEn: 'Black-backed jackal', commonNameFr: 'Chacal à chabraque', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'VUL-VUL', scientificName: 'Vulpes vulpes', commonNameEn: 'Red fox', commonNameFr: 'Renard roux', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'OTO-MEG', scientificName: 'Otocyon megalotis', commonNameEn: 'Bat-eared fox', commonNameFr: 'Otocyon', commonNamePt: 'Raposa-orelhuda', commonNameAr: 'ثعلب أذني', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CIV-CIV', scientificName: 'Civettictis civetta', commonNameEn: 'African civet', commonNameFr: "Civette d'Afrique", commonNamePt: 'Civeta africana', commonNameAr: 'زباد أفريقي', category: 'WILDLIFE', productionCategories: ['musk'], isWoahListed: false },
  { code: 'GEN-GEN', scientificName: 'Genetta genetta', commonNameEn: 'Common genet', commonNameFr: 'Genette commune', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'MEL-CAP', scientificName: 'Mellivora capensis', commonNameEn: 'Honey badger', commonNameFr: 'Ratel', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Reptiles ──
  { code: 'CRO-NIL', scientificName: 'Crocodylus niloticus', commonNameEn: 'Nile crocodile', commonNameFr: 'Crocodile du Nil', commonNamePt: 'Crocodilo-do-nilo', commonNameAr: 'تمساح النيل', category: 'WILDLIFE', productionCategories: ['leather', 'ranching'], isWoahListed: false },
  { code: 'VAR-NIL', scientificName: 'Varanus niloticus', commonNameEn: 'Nile monitor', commonNameFr: 'Varan du Nil', commonNamePt: 'Varano-do-nilo', commonNameAr: 'ورل النيل', category: 'WILDLIFE', productionCategories: ['leather'], isWoahListed: false },
  { code: 'PYT-SEB', scientificName: 'Python sebae', commonNameEn: 'African rock python', commonNameFr: 'Python de Seba', commonNamePt: 'Píton-africana', commonNameAr: 'أفعى بايثون أفريقية', category: 'WILDLIFE', productionCategories: ['leather'], isWoahListed: false },
  { code: 'CHE-PAR', scientificName: 'Chelonia mydas', commonNameEn: 'Green sea turtle', commonNameFr: 'Tortue verte', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'DER-COR', scientificName: 'Dermochelys coriacea', commonNameEn: 'Leatherback sea turtle', commonNameFr: 'Tortue luth', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Wildlife — Birds (wild) ──
  { code: 'BAL-PAV', scientificName: 'Balearica pavonina', commonNameEn: 'Black crowned crane', commonNameFr: 'Grue couronnée noire', commonNamePt: 'Grou-coroado', commonNameAr: 'كركي متوج', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'BAL-REG', scientificName: 'Balearica regulorum', commonNameEn: 'Grey crowned crane', commonNameFr: 'Grue royale', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'SAG-SER', scientificName: 'Sagittarius serpentarius', commonNameEn: 'Secretary bird', commonNameFr: 'Messager sagittaire', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'GYP-AFR', scientificName: 'Gyps africanus', commonNameEn: 'White-backed vulture', commonNameFr: 'Vautour africain', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PHO-RUB', scientificName: 'Phoenicopterus roseus', commonNameEn: 'Greater flamingo', commonNameFr: 'Flamant rose', commonNamePt: 'Flamingo', commonNameAr: 'فلامنغو', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PHO-MIN', scientificName: 'Phoeniconaias minor', commonNameEn: 'Lesser flamingo', commonNameFr: 'Flamant nain', commonNamePt: '', commonNameAr: '', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PEL-ONO', scientificName: 'Pelecanus onocrotalus', commonNameEn: 'Great white pelican', commonNameFr: 'Pélican blanc', commonNamePt: 'Pelicano', commonNameAr: 'بجع', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PSI-ERY', scientificName: 'Psittacus erithacus', commonNameEn: 'African grey parrot', commonNameFr: 'Perroquet jaco', commonNamePt: 'Papagaio', commonNameAr: 'ببغاء', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Aquatic — Freshwater fish ──
  { code: 'ORE-NIL', scientificName: 'Oreochromis niloticus', commonNameEn: 'Nile tilapia', commonNameFr: 'Tilapia du Nil', commonNamePt: 'Tilápia-do-nilo', commonNameAr: 'بلطي نيلي', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: true, faoAlphaCode: 'TLN' },
  { code: 'ORE-AUR', scientificName: 'Oreochromis aureus', commonNameEn: 'Blue tilapia', commonNameFr: 'Tilapia bleu', commonNamePt: 'Tilápia-dourada', commonNameAr: 'بلطي ذهبي', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false, faoAlphaCode: 'OEA' },
  { code: 'ORE-MOS', scientificName: 'Oreochromis mossambicus', commonNameEn: 'Mozambique tilapia', commonNameFr: 'Tilapia du Mozambique', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false, faoAlphaCode: 'TLM' },
  { code: 'TIL-ZIL', scientificName: 'Tilapia zillii', commonNameEn: 'Redbelly tilapia', commonNameFr: 'Tilapia de Zill', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: false, faoAlphaCode: 'TLZ' },
  { code: 'CLA-GAR', scientificName: 'Clarias gariepinus', commonNameEn: 'African catfish', commonNameFr: 'Poisson-chat africain', commonNamePt: 'Peixe-gato-africano', commonNameAr: 'سمك القط الأفريقي', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: false, faoAlphaCode: 'CLZ' },
  { code: 'HET-LON', scientificName: 'Heterobranchus longifilis', commonNameEn: 'African catfish (longfin)', commonNameFr: 'Silure africain', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false, faoAlphaCode: 'HEL' },
  { code: 'LAT-NIL', scientificName: 'Lates niloticus', commonNameEn: 'Nile perch', commonNameFr: 'Perche du Nil', commonNamePt: 'Perca-do-nilo', commonNameAr: 'سمك قشر البياض', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'NIP' },
  { code: 'LAB-COU', scientificName: 'Labeo coubie', commonNameEn: 'African carp', commonNameFr: 'Carpe africaine', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'LBU' },
  { code: 'BAG-BAY', scientificName: 'Bagrus bajad', commonNameEn: 'Bayad', commonNameFr: 'Machoiron', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'BGJ' },
  { code: 'GYM-NIL', scientificName: 'Gymnarchus niloticus', commonNameEn: 'Aba aba', commonNameFr: 'Poisson-cheval', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'OGN' },
  { code: 'MOR-RUM', scientificName: 'Mormyrus rume', commonNameEn: 'Mormyrid', commonNameFr: 'Mormyre', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'OMO' },
  { code: 'CYP-CAR', scientificName: 'Cyprinus carpio', commonNameEn: 'Common carp', commonNameFr: 'Carpe commune', commonNamePt: 'Carpa', commonNameAr: 'سمك الشبوط', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false, faoAlphaCode: 'FCP' },
  { code: 'PRO-NIL', scientificName: 'Protopterus annectens', commonNameEn: 'West African lungfish', commonNameFr: 'Protoptère', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'PPG' },
  { code: 'ONC-MYK', scientificName: 'Oncorhynchus mykiss', commonNameEn: 'Rainbow trout', commonNameFr: 'Truite arc-en-ciel', commonNamePt: 'Truta arco-íris', commonNameAr: 'سمك السلمون المرقط', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: true, faoAlphaCode: 'TRR' },
  { code: 'MUG-CEP', scientificName: 'Mugil cephalus', commonNameEn: 'Flathead grey mullet', commonNameFr: 'Mulet à grosse tête', commonNamePt: 'Tainha', commonNameAr: 'سمك البوري', category: 'AQUATIC', productionCategories: ['capture', 'aquaculture'], isWoahListed: false, faoAlphaCode: 'MUF' },

  // ── Aquatic — Marine fish ──
  { code: 'SAR-PIL', scientificName: 'Sardina pilchardus', commonNameEn: 'European pilchard', commonNameFr: 'Sardine', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'PIL' },
  { code: 'SAR-AUR', scientificName: 'Sardinella aurita', commonNameEn: 'Round sardinella', commonNameFr: 'Sardinelle ronde', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'SAA' },
  { code: 'SAR-MAD', scientificName: 'Sardinella maderensis', commonNameEn: 'Flat sardinella', commonNameFr: 'Sardinelle plate', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'SAE' },
  { code: 'CLU-SPP', scientificName: 'Clupeidae', commonNameEn: 'Clupeids nei', commonNameFr: 'Clupéidés nca', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'CLP' },
  { code: 'THU-ALB', scientificName: 'Thunnus albacares', commonNameEn: 'Yellowfin tuna', commonNameFr: 'Albacore', commonNamePt: 'Atum-albacora', commonNameAr: 'تونة الباكور', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'YFT' },
  { code: 'THU-OBE', scientificName: 'Thunnus obesus', commonNameEn: 'Bigeye tuna', commonNameFr: 'Thon obèse', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'BET' },
  { code: 'KAT-PEL', scientificName: 'Katsuwonus pelamis', commonNameEn: 'Skipjack tuna', commonNameFr: 'Bonite à ventre rayé', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'SKJ' },
  { code: 'XIP-GLA', scientificName: 'Xiphias gladius', commonNameEn: 'Swordfish', commonNameFr: 'Espadon', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'SWO' },
  { code: 'SCO-JAP', scientificName: 'Scomber japonicus', commonNameEn: 'Chub mackerel', commonNameFr: 'Maquereau espagnol', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'MAS' },
  { code: 'TRA-TRA', scientificName: 'Trachurus trachurus', commonNameEn: 'Horse mackerel', commonNameFr: 'Chinchard commun', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'HOM' },
  { code: 'MER-MER', scientificName: 'Merluccius merluccius', commonNameEn: 'Hake', commonNameFr: 'Merlu commun', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'HKE' },
  { code: 'DEN-MAC', scientificName: 'Dentex macrophthalmus', commonNameEn: 'Large-eye dentex', commonNameFr: 'Denté à gros yeux', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'DEL' },
  { code: 'PAG-PAG', scientificName: 'Pagellus bellottii', commonNameEn: 'Red pandora', commonNameFr: 'Pageot rouge', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'PAR' },
  { code: 'EPH-AEN', scientificName: 'Epinephelus aeneus', commonNameEn: 'White grouper', commonNameFr: 'Mérou blanc', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'GPW' },
  { code: 'PSE-SEN', scientificName: 'Pseudotolithus senegalensis', commonNameEn: 'Cassava croaker', commonNameFr: 'Otolithe du Sénégal', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'PSS' },
  { code: 'ETH-FIM', scientificName: 'Ethmalosa fimbriata', commonNameEn: 'Bonga shad', commonNameFr: 'Ethmalose', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'BOA' },

  // ── Aquatic — Crustaceans & molluscs ──
  { code: 'PEN-MON', scientificName: 'Penaeus monodon', commonNameEn: 'Giant tiger prawn', commonNameFr: 'Crevette géante tigrée', commonNamePt: 'Camarão-tigre-gigante', commonNameAr: 'روبيان النمر العملاق', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: true, faoAlphaCode: 'GIT' },
  { code: 'PEN-VAN', scientificName: 'Litopenaeus vannamei', commonNameEn: 'Whiteleg shrimp', commonNameFr: 'Crevette à pattes blanches', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false, faoAlphaCode: 'PNV' },
  { code: 'PEN-SPP', scientificName: 'Penaeus spp.', commonNameEn: 'Penaeid shrimps nei', commonNameFr: 'Crevettes pénéides nca', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'PEN' },
  { code: 'PAN-HOM', scientificName: 'Panulirus homarus', commonNameEn: 'Scalloped spiny lobster', commonNameFr: 'Langouste festonnée', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'LOK' },
  { code: 'CRA-CRA', scientificName: 'Crassostrea gigas', commonNameEn: 'Pacific oyster', commonNameFr: 'Huître creuse', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: true, faoAlphaCode: 'OYG' },
  { code: 'MYT-GAL', scientificName: 'Mytilus galloprovincialis', commonNameEn: 'Mediterranean mussel', commonNameFr: 'Moule méditerranéenne', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false, faoAlphaCode: 'MSM' },
  { code: 'OCT-VUL', scientificName: 'Octopus vulgaris', commonNameEn: 'Common octopus', commonNameFr: 'Poulpe commun', commonNamePt: 'Polvo', commonNameAr: 'أخطبوط', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'OCC' },
  { code: 'SEP-OFF', scientificName: 'Sepia officinalis', commonNameEn: 'Common cuttlefish', commonNameFr: 'Seiche commune', commonNamePt: 'Choco', commonNameAr: 'حبار', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false, faoAlphaCode: 'CTC' },

  // ── Aquatic — Marine mammals ──
  { code: 'TUR-TRU', scientificName: 'Tursiops truncatus', commonNameEn: 'Bottlenose dolphin', commonNameFr: 'Grand dauphin', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: [], isWoahListed: false },
  { code: 'DUG-DUG', scientificName: 'Dugong dugon', commonNameEn: 'Dugong', commonNameFr: 'Dugong', commonNamePt: '', commonNameAr: '', category: 'AQUATIC', productionCategories: [], isWoahListed: false },
  { code: 'TRI-MAN', scientificName: 'Trichechus senegalensis', commonNameEn: 'African manatee', commonNameFr: "Lamantin d'Afrique", commonNamePt: 'Peixe-boi africano', commonNameAr: 'خروف البحر الأفريقي', category: 'AQUATIC', productionCategories: [], isWoahListed: false },

  // ── Apiculture ──
  { code: 'API-MEL', scientificName: 'Apis mellifera', commonNameEn: 'Western honey bee', commonNameFr: 'Abeille domestique', commonNamePt: 'Abelha europeia', commonNameAr: 'نحل العسل الأوروبي', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'API-ADA', scientificName: 'Apis mellifera adansonii', commonNameEn: 'African honey bee', commonNameFr: 'Abeille africaine', commonNamePt: 'Abelha africana', commonNameAr: 'نحل العسل الأفريقي', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'API-SCU', scientificName: 'Apis mellifera scutellata', commonNameEn: 'East African lowland honey bee', commonNameFr: 'Abeille de plaine est-africaine', commonNamePt: 'Abelha-sem-ferrão', commonNameAr: 'نحل بلا لسعة', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'MEL-BEE', scientificName: 'Meliponini spp.', commonNameEn: 'Stingless bee', commonNameFr: 'Abeille sans dard', commonNamePt: '', commonNameAr: '', category: 'APICULTURE', productionCategories: ['honey', 'pollination'], isWoahListed: false },
];
