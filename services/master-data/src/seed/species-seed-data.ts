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

  // ── Wildlife ──
  { code: 'SYN-CAF', scientificName: 'Syncerus caffer', commonNameEn: 'African buffalo', commonNameFr: 'Buffle d\'Afrique', category: 'WILDLIFE', productionCategories: [], isWoahListed: true },
  { code: 'GIR-CAM', scientificName: 'Giraffa camelopardalis', commonNameEn: 'Giraffe', commonNameFr: 'Girafe', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'LOX-AFR', scientificName: 'Loxodonta africana', commonNameEn: 'African elephant', commonNameFr: 'Éléphant d\'Afrique', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-LEO', scientificName: 'Panthera leo', commonNameEn: 'Lion', commonNameFr: 'Lion', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PAN-PAR', scientificName: 'Panthera pardus', commonNameEn: 'Leopard', commonNameFr: 'Léopard', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'DIC-BIC', scientificName: 'Diceros bicornis', commonNameEn: 'Black rhinoceros', commonNameFr: 'Rhinocéros noir', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'CER-SIM', scientificName: 'Ceratotherium simum', commonNameEn: 'White rhinoceros', commonNameFr: 'Rhinocéros blanc', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'HIP-AMP', scientificName: 'Hippopotamus amphibius', commonNameEn: 'Hippopotamus', commonNameFr: 'Hippopotame', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'PHA-AET', scientificName: 'Phacochoerus africanus', commonNameEn: 'Warthog', commonNameFr: 'Phacochère', category: 'WILDLIFE', productionCategories: [], isWoahListed: true },
  { code: 'CON-TAU', scientificName: 'Connochaetes taurinus', commonNameEn: 'Blue wildebeest', commonNameFr: 'Gnou bleu', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'AEP-MEL', scientificName: 'Aepyceros melampus', commonNameEn: 'Impala', commonNameFr: 'Impala', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'ORY-GAZ', scientificName: 'Oryx gazella', commonNameEn: 'Gemsbok', commonNameFr: 'Oryx gazelle', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },
  { code: 'TRA-STR', scientificName: 'Tragelaphus strepsiceros', commonNameEn: 'Greater kudu', commonNameFr: 'Grand koudou', category: 'WILDLIFE', productionCategories: [], isWoahListed: false },

  // ── Aquatic ──
  { code: 'ORE-NIL', scientificName: 'Oreochromis niloticus', commonNameEn: 'Nile tilapia', commonNameFr: 'Tilapia du Nil', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: true },
  { code: 'CLA-GAR', scientificName: 'Clarias gariepinus', commonNameEn: 'African catfish', commonNameFr: 'Poisson-chat africain', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: false },
  { code: 'LAT-NIL', scientificName: 'Lates niloticus', commonNameEn: 'Nile perch', commonNameFr: 'Perche du Nil', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'SAR-PIL', scientificName: 'Sardina pilchardus', commonNameEn: 'European pilchard', commonNameFr: 'Sardine', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'THU-ALB', scientificName: 'Thunnus albacares', commonNameEn: 'Yellowfin tuna', commonNameFr: 'Albacore', category: 'AQUATIC', productionCategories: ['capture'], isWoahListed: false },
  { code: 'PEN-MON', scientificName: 'Penaeus monodon', commonNameEn: 'Giant tiger prawn', commonNameFr: 'Crevette géante tigrée', category: 'AQUATIC', productionCategories: ['aquaculture', 'capture'], isWoahListed: true },
  { code: 'CRA-CRA', scientificName: 'Crassostrea gigas', commonNameEn: 'Pacific oyster', commonNameFr: 'Huître creuse', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: true },
  { code: 'MYT-GAL', scientificName: 'Mytilus galloprovincialis', commonNameEn: 'Mediterranean mussel', commonNameFr: 'Moule méditerranéenne', category: 'AQUATIC', productionCategories: ['aquaculture'], isWoahListed: false },

  // ── Apiculture ──
  { code: 'API-MEL', scientificName: 'Apis mellifera', commonNameEn: 'Western honey bee', commonNameFr: 'Abeille domestique', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'API-ADA', scientificName: 'Apis mellifera adansonii', commonNameEn: 'African honey bee', commonNameFr: 'Abeille africaine', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'API-SCU', scientificName: 'Apis mellifera scutellata', commonNameEn: 'East African lowland honey bee', commonNameFr: 'Abeille de plaine est-africaine', category: 'APICULTURE', productionCategories: ['honey', 'wax', 'pollination'], isWoahListed: true },
  { code: 'MEL-BEE', scientificName: 'Meliponini spp.', commonNameEn: 'Stingless bee', commonNameFr: 'Abeille sans dard', category: 'APICULTURE', productionCategories: ['honey', 'pollination'], isWoahListed: false },
];
