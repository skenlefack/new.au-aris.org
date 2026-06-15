-- PAID v2 Schema — New hierarchical tables for LICS projects
-- Run in: animal_health schema on PostgreSQL 16

-- ============================================================
-- 1. Drop old PAID tables
-- ============================================================
DROP TABLE IF EXISTS animal_health.paid_partners_national CASCADE;
DROP TABLE IF EXISTS animal_health.paid_partners_intl CASCADE;
DROP TABLE IF EXISTS animal_health.paid_projects CASCADE;
DROP TABLE IF EXISTS animal_health.paid_diseases CASCADE;
DROP TABLE IF EXISTS animal_health.paid_production_systems CASCADE;
DROP TABLE IF EXISTS animal_health.paid_species CASCADE;
DROP TABLE IF EXISTS animal_health.paid_activities CASCADE;
DROP TABLE IF EXISTS animal_health.paid_sectors CASCADE;

-- ============================================================
-- 2. Create new PAID v2 tables
-- ============================================================

-- Projects (LICS: OHDAA, ANGR, LIVESYS, VET_GOV)
CREATE TABLE IF NOT EXISTS animal_health.paid_projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'single_country',
  countries TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_projects_type ON animal_health.paid_projects(type);

-- Executive partners (per project)
CREATE TABLE IF NOT EXISTS animal_health.paid_executive_partners (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(30) NOT NULL,
  name VARCHAR(300) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_exec_partners_project ON animal_health.paid_executive_partners(project_code);

-- Implementing partners international (per project)
CREATE TABLE IF NOT EXISTS animal_health.paid_impl_partners_intl (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(30) NOT NULL,
  name VARCHAR(300) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_impl_intl_project ON animal_health.paid_impl_partners_intl(project_code);

-- Implementing partners national (per project + country)
CREATE TABLE IF NOT EXISTS animal_health.paid_impl_partners_national (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(30) NOT NULL,
  country_code VARCHAR(5),
  name VARCHAR(300) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_impl_nat_project ON animal_health.paid_impl_partners_national(project_code);
CREATE INDEX idx_paid_impl_nat_country ON animal_health.paid_impl_partners_national(country_code);

-- Log Frame Activity (AMERT) — per project
CREATE TABLE IF NOT EXISTS animal_health.paid_logframes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  project_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_logframes_project ON animal_health.paid_logframes(project_code);

-- Activity — per logframe
CREATE TABLE IF NOT EXISTS animal_health.paid_lf_activities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  logframe_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_lf_activities_logframe ON animal_health.paid_lf_activities(logframe_code);

-- Sub-activity — per activity
CREATE TABLE IF NOT EXISTS animal_health.paid_subactivities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  activity_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  unit_of_measure VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_subactivities_activity ON animal_health.paid_subactivities(activity_code);

-- PAID Activity — per sub-activity (carries the unit of measure)
CREATE TABLE IF NOT EXISTS animal_health.paid_paid_activities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  subactivity_code VARCHAR(30) NOT NULL,
  label TEXT NOT NULL,
  unit_of_measure VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paid_paid_activities_sub ON animal_health.paid_paid_activities(subactivity_code);

-- Breakdown fields config (dynamic fields per PAID activity)
CREATE TABLE IF NOT EXISTS animal_health.paid_breakdown_fields (
  id SERIAL PRIMARY KEY,
  paid_activity_code VARCHAR(50) NOT NULL,
  field_code VARCHAR(50) NOT NULL,
  field_label TEXT NOT NULL,
  field_type VARCHAR(20) NOT NULL DEFAULT 'number',
  field_options JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(paid_activity_code, field_code)
);
CREATE INDEX idx_paid_breakdown_pa ON animal_health.paid_breakdown_fields(paid_activity_code);


-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO animal_health.paid_projects (code, title, type, countries) VALUES ('ANGR', 'Animal Genetics Resources (AnGR)', 'multiple_countries', '{KE,ET,NG,TZ,UG,SN,CM,ZA}') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_projects (code, title, type, countries) VALUES ('LIVESYS', 'Climate Resilient and Sustainable Livestock Systems', 'multiple_countries', '{KE,ET,NG,TZ,UG,SN,NE,ML,BF,TD}') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_projects (code, title, type, countries) VALUES ('OHDAA', 'One Health, Disease Control, Animal Health & Veterinary Governance', 'multiple_countries', '{KE,ET,NG,TZ,UG,SN,CM,GH,ZA,MZ}') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_projects (code, title, type, countries) VALUES ('VET_GOV', 'Veterinary Governance and Animal Welfare', 'multiple_countries', '{KE,ET,NG,TZ,UG,SN,CM,GH,ZA,MZ}') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_executive_partners (project_code, name) VALUES ('ANGR', 'AU-IBAR');
INSERT INTO animal_health.paid_executive_partners (project_code, name) VALUES ('LIVESYS', 'AU-IBAR');
INSERT INTO animal_health.paid_executive_partners (project_code, name) VALUES ('OHDAA', 'AU-IBAR');
INSERT INTO animal_health.paid_executive_partners (project_code, name) VALUES ('OHDAA', 'FAO');
INSERT INTO animal_health.paid_executive_partners (project_code, name) VALUES ('VET_GOV', 'AU-IBAR');

-- Project: ANGR
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.2.1', 'ANGR', '# of African Union Animal Seed Centres of Excellence (CoEs) supported to provide services to AU MSs') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.2.1.01', '2.2.1', 'Promote and operationalize the African Union Animal Seed Centres of Excellence and the continental gene bank') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.01.01', '2.2.1.01', 'Support the MOU approvals and domestication and SOPs', 'Number of MOUs approved and SOPs developed and domesticated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.01.01_PA', '2.2.1.01.01', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.01.02', '2.2.1.01', 'Establish a virtual African animal Network for Animal resources seed centers of Excellence', 'Number of coordination platforms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.01.02_PA', '2.2.1.01.02', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.01.03', '2.2.1.01', 'Build capacity on technical capacity of livestock seed quality assurance and dissemination', 'Number of capacity-building activities conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.01.03_PA', '2.2.1.01.03', 'Training /sensitization/Capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.2.1.01.03_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.2.1.01.03_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.2.1.02', '2.2.1', 'Promote innovative business-oriented Animal seed systems for better resilience and productivity') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.02.01', '2.2.1.02', 'Develop national AnGR digital data collection tools and data management systems', 'Number of data systems and tools developed and operationalized') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.02.01_PA', '2.2.1.02.01', 'Management of Information System/ Database', 'number') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.02.02', '2.2.1.02', 'Promote the establishment of national selection and elite breeding programs', 'Number of breeding programmes established and supported') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.2.1.03', '2.2.1', 'Strengthen regional and national extension systems and initiatives for wider dissemination of genetic gains') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.03.01', '2.2.1.03', 'Undertake training of trainers for extension services', 'Number of training-of-trainers sessions conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.03.01_PA', '2.2.1.03.01', 'Training of Master Trainers (ToMT) (including refresher trainings)', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.2.1.03.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.2.1.03.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.03.02', '2.2.1.03', 'Build efficient research - extension - farmer co-ordination mechanisms to improve technology and innovation development, uptake and upscaling', 'Number of coordination mechanisms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.03.02_PA', '2.2.1.03.02', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.2.1.04', '2.2.1', 'Strengthen policy, regulatory and institutional capacities for sustainable animal genetics systems') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.04.01', '2.2.1.04', 'Draft National Animal Genetic Resources Strategies', 'Number of national strategies developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.04.01_PA', '2.2.1.04.01', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.04.02', '2.2.1.04', 'Establish Animal seed policy and regulations systems', 'Number of policy and regulatory frameworks developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.04.02_PA', '2.2.1.04.02', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.2.1.04.03', '2.2.1.04', 'Formulate and domesticate national animal seed industry guidelines and standards', 'Number of guidelines and standards developed and domesticated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.04.03_PA', '2.2.1.04.03', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.2.1.05', '2.2.1', 'Project Staff Costs') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.2.1.06', '2.2.1', 'Other Project Operating Costs') ON CONFLICT (code) DO NOTHING;

-- Project: LIVESYS
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.3.1', 'LIVESYS', 'Output Indicator: Number of Member States supported to effectively participate at global climate change agenda fora') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.3.1.01', '2.3.1', 'Promote enabling institutional and policy environment for increased targeted Investment for climate smart production systems') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.01.01', '2.3.1.01', 'Develop and domesticate an Africa Common Position on Sustainable, Resilient and Nature-positive livetsock systems', 'Number of continental policy positions developed and domesticated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.01.01_PA', '2.3.1.01.01', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.01.02', '2.3.1.01', 'Establish and Operationalize an Africa Think Tank Network to spearhead synergy and coherence in climate action for livestock food systems', 'Number of coordination platforms established and operationalized') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.01.02_PA', '2.3.1.01.02', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.01.03', '2.3.1.01', 'Support the integration and inclusion of livestock and biodiversity agendas into national climate change adaptation plans and strategies to increase resilience of local communities and national economies', 'Number of Member States supported in policy integration') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.01.03_PA', '2.3.1.01.03', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.3.1.02', '2.3.1', 'Develop and promote innovative financing models for increased climate-positive investments') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.02.01', '2.3.1.02', 'Publish and disseminate  continental guidelines on livestock climate finance', 'Number of guidelines developed and disseminated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.02.01_PA', '2.3.1.02.01', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.02.02', '2.3.1.02', 'Strengthen member states co-ordination mechanims with Africa Group of Negotiators (AGN) - specific livestock climate finance actions', 'Number of coordination engagements conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.02.02_PA', '2.3.1.02.02', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.02.03', '2.3.1.02', 'Establish a continental mobilization hub targeting public,private, CSOs, and
development partners for climate and livestock', 'Number of financing platforms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.02.03_PA', '2.3.1.02.03', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.3.1.03', '2.3.1', 'Enhance capacities for climate-smart technologies and innovations uptake and transfer') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.03.01', '2.3.1.03', 'Support training on Tracking  Adaptation in Livestock Systems (TaILs) and other select innovations', 'Number of training and capacity-building activities conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.03.01_PA', '2.3.1.03.01', 'Training /sensitization/Capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.3.1.03.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.3.1.03.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.3.1.04', '2.3.1', 'Strengthen Governance and support the generation and dissemination of knowledge products for improved climate mitigation and adaptation practises') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.04.01', '2.3.1.04', 'Support the development e-training modules for climate adaptation and mitigation approaches for livestock production systems', 'Number of training modules developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.04.01_PA', '2.3.1.04.01', 'Training /sensitization/Capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.3.1.04.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.3.1.04.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.04.02', '2.3.1.04', 'Development and operationalization of the Climate and livestock training and knowledge hub', 'Number of knowledge systems developed and operationalized') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.04.02_PA', '2.3.1.04.02', 'Management of Information System/ Database', 'number') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.3.1.04.03', '2.3.1.04', 'Establish and operationalize a climate livetsock consortium - climate risk analytics, inventorires on livestock methane emmissions etc', 'Number of coordination platforms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.3.1.04.03_PA', '2.3.1.04.03', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.3.1.05', '2.3.1', 'Project Staff Costs') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.3.1.06', '2.3.1', 'Other project operating costs') ON CONFLICT (code) DO NOTHING;

-- Project: OHDAA
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.6.1', 'OHDAA', '% implementation of the continental strategy for the elimination of Rabies') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.1.01', '2.6.1', 'Develop, validate and implement a continental Rabies elimination strategy and Dog Population Management (DPM)') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.1.01.01', '2.6.1.01', 'Disseminate and create awareness on the Rabies Strategy', 'Number of advocacy and awareness activities conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.1.01.01_PA', '2.6.1.01.01', 'Policy and strategy Formulation', 'Report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.1.01.02', '2.6.1.01', 'Develop a continental programme for Rabies elimination', 'Number of continental programmes developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.1.01.02_PA', '2.6.1.01.02', 'policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.1.01.03', '2.6.1.01', 'Create/ strengthen governance mechanisms for the implementation of the Rabies Strategy', 'Number of governance mechanisms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.1.01.03_PA', '2.6.1.01.03', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.1.01.04', '2.6.1.01', 'Undertake resource  mobilization', '') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.6.2', 'OHDAA', 'Number of RECs supported to establish Centres of Excellence (CoEs) to promote and build animal health capacities in the region') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.2.01', '2.6.2', 'Promote PPPs for reinforcing veterinary governance at national, regional and continental levels') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.2.01.01', '2.6.2.01', 'Promote regional Public–Private Partnership guidelines to leverage the Africa Public-Private Partnership Forum', 'Number of policy guidelines developed and promoted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.2.01.01_PA', '2.6.2.01.01', 'policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.2.02', '2.6.2', 'Strengthen regional and continental platforms (2VSB, 2A2E-V, CAPH-Africa, RAHCs and RAHNs)') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.2.02.01', '2.6.2.02', 'Strengthen leadership capacities of Regional Animal Health Centres (RAHCs) and Regional Co-ordination Centres
(RCCs) to coordinate rapid response, including deployment of regional multisectoral (veterinary and public health)outreach teams', 'Number of capacity-building activities conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.2.02.01_PA', '2.6.2.02.01', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.2.02.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.2.02.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.2.03', '2.6.2', 'Strengthen capacities for veterinary services for early warning and response') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.2.03.01', '2.6.2.03', 'Strengthen capacity for integrated crossborder surveillance and response networks for pandemic and epidemic intelligence', 'Number of surveillance systems strengthened') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.2.03.01_PA', '2.6.2.03.01', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.2.03.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.2.03.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.2.03.02', '2.6.2.03', 'Build integrated surveillance and detection systems at points of entry (PoEs) and transhumance corridors for zoonotic diseases with pandemic potential', 'Number of surveillance systems established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.2.03.02_PA', '2.6.2.03.02', 'Alert from Early warning systems  /                                 Management of Information System/database', 'report/                    Number') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.2.03.03', '2.6.2.03', 'Strengthen the regional center of expertise for capacity building on multisectoral and cross-border pandemic  intelligence', 'Number of centres strengthened') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.2.03.03_PA', '2.6.2.03.03', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.2.03.03_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.2.03.03_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.6.3', 'OHDAA', '# of MSs supported to improve their capacities, align and implement the Animal Welfare Strategy for Africa') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.3.01', '2.6.3', 'Promote compliance with animal health and welfare standards') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.01.01', '2.6.3.01', 'Capacity building of Member States on animal health and welfare standards', 'Number of capacity-building activities conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.01.01_PA', '2.6.3.01.01', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.3.01.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.3.01.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.01.02', '2.6.3.01', 'Integration of animal welfare considerations into animal health programmes', 'Number of programmes integrating welfare') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.01.03', '2.6.3.01', 'conduct training sessions of RECs and AU-IBAR staff on the utilisation of LIRA and final report developed', 'Number of training sessions conducted; Number of reports developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.01.03_PA', '2.6.3.01.03', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.3.01.03_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.3.01.03_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.3.02', '2.6.3', 'Support adoption and domestication of animal welfare standards') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.02.01', '2.6.3.02', 'Support Capacity building and domestication of MSs and AW focal points', 'Number of capacity-building activities conducted, Number of Member States participating') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.02.01_PA', '2.6.3.02.01', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.3.02.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.3.02.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.02.02', '2.6.3.02', 'Support MSs and RECs Domestication of the Donkey Strategy', 'Number of MS and RECs supported') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.02.02_PA', '2.6.3.02.02', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.02.03', '2.6.3.02', 'develop report from findings on the opportunities to sustainably increase productivity in different livestock production systems', 'Number of analytical reports developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.02.03_PA', '2.6.3.02.03', 'Survey/assesments', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.3.03', '2.6.3', 'Support the establishment of regional animal welfare networks and formulation of strategies') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.03.01', '2.6.3.03', 'Revitalisation of existing regional animal welfare networks', 'Number of networks revitalized') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.03.01_PA', '2.6.3.03.01', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.03.02', '2.6.3.03', 'Support development and alignment of regional and national animal welfare strategies', 'Number of strategies developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.03.02_PA', '2.6.3.03.02', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.3.04', '2.6.3', 'Strengthen the African Platform for Animal Welfare (APAW) Secretariat') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.04.01', '2.6.3.04', 'Participate in AW Forum', 'Number of forums participated in') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.04.01_PA', '2.6.3.04.01', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.04.02', '2.6.3.04', 'Support the organisation of the 10th AAWC', 'Number of stakeholders engaged') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.04.02_PA', '2.6.3.04.02', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.3.04.03', '2.6.3.04', 'Convene continental and regional APAW coordination forums', 'Number of coordination forums conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.04.03_PA', '2.6.3.04.03', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.6.4', 'OHDAA', 'Number of strategies, frameworks for TADs prevention and control developed or revised, endorsed and coordinated at continental level') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.4.01', '2.6.4', 'Support Africa Swine Fever (ASF) prevention, control and response at national, regional and continental levels') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.01.01', '2.6.4.01', 'Finalize the continental ASF implementation roadmap', 'Number of strategies/roadmaps developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.01.01_PA', '2.6.4.01.01', 'policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.01.02', '2.6.4.01', 'Initiate a joint (FAO, WOAH, ILRI, RECs)  monitoring framework with standardized reporting and dashboards.', 'Number of monitoring systems developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.01.02_PA', '2.6.4.01.02', 'Management of Information System/database', 'number') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.01.03', '2.6.4.01', 'Develop, disseminate and analyse surveys to Member States and RECs to assess livestock value chain parameters, identify productivity constraints, and review existing livestock development strategies for alignment with identified needs.', 'Number of surveys conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.01.03_PA', '2.6.4.01.03', 'Survey/assesments', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.01.04', '2.6.4.01', 'Develop guidelines to support countries in adjusting investment priorities and allocate resources strategically', 'Number of guidelines developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.01.04_PA', '2.6.4.01.04', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.4.02', '2.6.4', 'Develop and validate the African Animal Trypanosomiasis (AAT) Continental strategy and action plan') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.02.01', '2.6.4.02', 'Disseminate and create awareness on the AAT Strategy', 'Number of dissemination activities conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.02.01_PA', '2.6.4.02.01', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.4.02.01_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.4.02.01_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.02.02', '2.6.4.02', 'Develop a continental programme for Africa Animal Trypanosomiasis', 'Number of programmes developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.02.02_PA', '2.6.4.02.02', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.02.03', '2.6.4.02', 'Create/ strengthen governance mechanisms for the implementation of the AAT strategy', 'Number of governance mechanisms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.02.03_PA', '2.6.4.02.03', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.02.04', '2.6.4.02', 'Undertake resource  mobilization', 'Number of resource mobilization initiatives conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.02.04_PA', '2.6.4.02.04', 'Grants', 'USD') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.6.5', 'OHDAA', '% implementation of the continental donkey welfare strategy') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.5.01', '2.6.5', 'Support formulation, validation and implementation the Donkey preservation strategy and action Plan') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.01', '2.6.5.01', 'Sustain the position of Donkey Expert', '') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.02', '2.6.5.01', 'Recruit and second an advocacy and campaigns advisor to AU-IBAR', '') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.03', '2.6.5.01', 'Extend mandate of the TWG,Meeting enagements', 'Number of TWG engagements conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.03_PA', '2.6.5.01.03', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.04', '2.6.5.01', 'Development of the concept note for the continental program', 'Number of concept notes developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.04_PA', '2.6.5.01.04', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.05', '2.6.5.01', 'Support the validation of ECOWAS donkey strategy (Western Africa)', 'Number of regional strategies validated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.05_PA', '2.6.5.01.05', 'policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.06', '2.6.5.01', 'Support the development and validation of regional strategy of IGAD/EAC (Eastern Africa)', 'Number of regional strategies developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.06_PA', '2.6.5.01.06', 'policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.07', '2.6.5.01', 'Develop and publish advocacy materials, policies briefs, leaflets, gadgets', 'Number of advocacy materials developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.07_PA', '2.6.5.01.07', 'Communication Media (radio, TV, video, pamphlet, newsletters, etc.)', 'number') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.08', '2.6.5.01', 'Promote the celebration of the Donkey day amongst MS and RECs', 'Number of awareness campaigns conducted, Number of MS Participating') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.08_PA', '2.6.5.01.08', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.5.01.08_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.6.5.01.08_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.01.09', '2.6.5.01', 'Support national parliament to enactment of donkey laws', 'Number of policy engagement initiatives conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.09_PA', '2.6.5.01.09', 'policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.5.02', '2.6.5', 'Establish Equidae/ donkey health care and breeding programme at national level') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.02.01', '2.6.5.02', 'Mapping of the priority diseases of the donkey species', 'Number of disease mapping studies conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.02.01_PA', '2.6.5.02.01', 'Survey/assesments', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.02.02', '2.6.5.02', 'Conduct stock taking of breeding systems', 'Number of assessments conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.02.02_PA', '2.6.5.02.02', 'Survey/assesments', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.5.02.03', '2.6.5.02', 'Country-level domestication', 'Number of MS supported') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.02.03_PA', '2.6.5.02.03', 'policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.7.1', 'OHDAA', 'Output Indicator: # of MSs supported to use the One Health Digital Data Platform') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.7.1.01', '2.7.1', 'Strengthen capacity of regional and national institutions on One Health data management and surveillance') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.7.1.02', '2.7.1', 'Develop a continental roadmap for the domestication of the African Union Digital One Health platform') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.7.1.03', '2.7.1', 'Develop the Digital One Health Curriculum and e-learning platform') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.7.1.04', '2.7.1', 'Roll-out the AU One Health Platform and feedback tool hosted at AU-IBAR in 5 MS and 2 RECs') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.7.1.05', '2.7.1', 'Establish and operationalize the Continental One Health Secretariat') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.7.1.06', '2.7.1', 'Project Staff Costs') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.7.2', 'OHDAA', 'Output Indicator: Number of MSs technical experts trained on digital One Health Data management and governance') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.7.2.01', '2.7.2', 'Develop and disseminate training manuals and Conduct Regional Training of trainers on data analytics and management') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.7.2.01.01', '2.7.2.01', 'Publish and disseminate training manuals, data agreements', 'Number of training manuals and agreements developed and disseminated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.7.2.01.01_PA', '2.7.2.01.01', 'Communication Media (radio, TV, video, pamphlet, newsletters, etc.)', 'number') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.7.2.01.02', '2.7.2.01', 'Build capacities (data analytics and informatics) on utilization of the African Union Digital One Health Platfrom (AU-DOHP) by African OH specialists', 'Number of capacity-building activities conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.7.2.01.02_PA', '2.7.2.01.02', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.7.2.01.02_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.7.2.01.02_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;

-- ============================================================
-- FIX: CBPP activity — corrected code 2.4.6.03 → 2.6.4.03
-- ============================================================
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.6.4.03', '2.6.4', 'Support Contagious Bovine Pleuro-Pneumonia (CBPP) prevention, control and response at national, regional and continental levels') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.6.4.03.01', '2.6.4.03', 'Initiate the development of the Continental Strategy for CBPP', 'Number of strategies initiated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.4.03.01_PA', '2.6.4.03.01', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- FIX: Missing PAID Activities for orphan sub-activities
-- ============================================================
-- 2.2.1.02.02: Breeding programs — no PAID Activity was defined
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.2.1.02.02_PA', '2.2.1.02.02', 'Technical Field Support mission', 'report') ON CONFLICT (code) DO NOTHING;

-- 2.6.1.01.04: Resource mobilization — no unit in Excel
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.1.01.04_PA', '2.6.1.01.04', 'Grants', 'USD') ON CONFLICT (code) DO NOTHING;

-- 2.6.3.01.02: Welfare integration into health programmes
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.3.01.02_PA', '2.6.3.01.02', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

-- 2.6.5.01.01: Sustain Donkey Expert position
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.01_PA', '2.6.5.01.01', 'Project Staff Costs', 'person-months') ON CONFLICT (code) DO NOTHING;

-- 2.6.5.01.02: Recruit advocacy advisor
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.6.5.01.02_PA', '2.6.5.01.02', 'Project Staff Costs', 'person-months') ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Project: PPR — Peste des Petits Ruminants eradication
-- ============================================================
INSERT INTO animal_health.paid_projects (code, title, type, countries) VALUES ('PPR', 'PPR Eradication Programme', 'multiple_countries', '{KE,ET,NG,TZ,UG,SN,CM,GH,ZA,MZ,NE,ML,BF,TD,SO,SD,SS}') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_executive_partners (project_code, name) VALUES ('PPR', 'AU-IBAR');
INSERT INTO animal_health.paid_executive_partners (project_code, name) VALUES ('PPR', 'PANVAC');

-- Logframe 2.9.1
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.9.1', 'PPR', '# of MSs whose capacities are strengthened to eradicate PPR') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.01', '2.9.1', 'Establish formal linkages and modalities for cooperation and coordination') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.01.00', '2.9.1.01', 'Establish formal linkages and modalities for cooperation and coordination', 'Number of coordination mechanisms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.01.00_PA', '2.9.1.01.00', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.02', '2.9.1', 'Develop strategies for vaccination based on a clear understanding of animal mobility') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.02.00', '2.9.1.02', 'Develop strategies for vaccination based on a clear understanding of animal mobility', 'Number of vaccination strategies developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.02.00_PA', '2.9.1.02.00', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.03', '2.9.1', 'Develop PPR resource mobilisation plan') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.03.00', '2.9.1.03', 'Develop PPR resource mobilisation plan', 'Number of resource mobilization plans developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.03.00_PA', '2.9.1.03.00', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.04', '2.9.1', 'Develop a PPR business model') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.04.00', '2.9.1.04', 'Develop a PPR business model', 'Number of business models developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.04.00_PA', '2.9.1.04.00', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.05', '2.9.1', 'Develop PPR eradication strategy and implementation plan') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.05.00', '2.9.1.05', 'Develop PPR eradication strategy and implementation plan', 'Number of strategies and plans developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.05.00_PA', '2.9.1.05.00', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.06', '2.9.1', 'Validate the strategy and implementation plan with stakeholders') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.06.00', '2.9.1.06', 'Validate the strategy and implementation plan with stakeholders', 'Number of validation workshops conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.06.00_PA', '2.9.1.06.00', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.07', '2.9.1', 'Analyse data on vaccination and impact on disease occurrence in countries') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.07.00', '2.9.1.07', 'Analyse data on vaccination and impact on disease occurrence in countries', 'Number of analytical studies conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.07.00_PA', '2.9.1.07.00', 'Survey/assesments', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.08', '2.9.1', 'Prepare exit strategies') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.08.00', '2.9.1.08', 'Prepare exit strategies', 'Number of exit strategies developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.08.00_PA', '2.9.1.08.00', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.09', '2.9.1', 'Review/update the continental PPR eradication strategy, programme and plan') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.09.00', '2.9.1.09', 'Review/update the continental PPR eradication strategy, programme and plan', 'Number of strategies reviewed and updated') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.09.00_PA', '2.9.1.09.00', 'Policy and strategy Formulation', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.10', '2.9.1', 'Establish a PPR protection area/buffer zone') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.10.00', '2.9.1.10', 'Establish a PPR protection area/buffer zone', 'Number of protection zones established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.10.00_PA', '2.9.1.10.00', 'Quarantine zones (creation, rehabilitation, etc.)', 'Quarantine zones') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.11', '2.9.1', 'AU-IBAR, PANVAC, FAO, WOAH, RECS and RAHNs provide technical support') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.11.00', '2.9.1.11', 'AU-IBAR, PANVAC, FAO, WOAH, RECS and RAHNs provide technical support', 'Number of technical support missions conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.11.00_PA', '2.9.1.11.00', 'Technical Field Support mission', 'Man Days') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.12', '2.9.1', 'Support selected member states to carry out PPR surveillance') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.12.00', '2.9.1.12', 'Support selected member states to carry out PPR surveillance', 'Number of surveillance activities supported') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.12.00_PA', '2.9.1.12.00', 'Epidemio-Surveillance survey', 'survey') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.13', '2.9.1', 'Support and strengthen data collection, storage and analysis') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.13.00', '2.9.1.13', 'Support and strengthen data collection, storage and analysis', 'Number of data systems strengthened') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.13.00_PA', '2.9.1.13.00', 'Management of Information System/database', 'number') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.14', '2.9.1', 'Support and provide guidance to national Veterinary services') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.14.00', '2.9.1.14', 'Support and provide guidance to national Veterinary services', 'Number of technical support interventions conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.14.00_PA', '2.9.1.14.00', 'Support to private vets', 'persons') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.15', '2.9.1', 'Undertake targeted and risk-based vaccination to consolidate the achievements') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.15.00', '2.9.1.15', 'Undertake targeted and risk-based vaccination to consolidate the achievements', 'Number of vaccination campaigns conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.15.00_PA', '2.9.1.15.00', 'Vaccination', 'heads') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.16', '2.9.1', 'Use appropriate laboratory mapping tools to assess national and regional laboratories') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.16.00', '2.9.1.16', 'Use appropriate laboratory mapping tools to assess national and regional laboratories', 'Number of laboratory assessments conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.16.00_PA', '2.9.1.16.00', 'Mapping of Livestock Value Chain Actors', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.17', '2.9.1', 'Sensitise and raise awareness among different stakeholders on PPR') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.17.00', '2.9.1.17', 'Sensitise and raise awareness among different stakeholders on PPR', 'Number of sensitization/awareness initiatives conducted') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.17.00_PA', '2.9.1.17.00', 'Training/sensitization/capacity building', 'persons') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.9.1.17.00_PA', 'n_female_trained', 'Number of females trained', 'number', 0, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;
INSERT INTO animal_health.paid_breakdown_fields (paid_activity_code, field_code, field_label, field_type, sort_order, is_required) VALUES ('2.9.1.17.00_PA', 'n_male_trained', 'Number of males trained', 'number', 1, false) ON CONFLICT (paid_activity_code, field_code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.18', '2.9.1', 'Establish a multi-stakeholder forum (Continental Advisory Group)') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.18.00', '2.9.1.18', 'Establish a multi-stakeholder forum (Continental Advisory Group)', 'Number of coordination platforms established') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.18.00_PA', '2.9.1.18.00', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.19', '2.9.1', 'Project Staff Costs') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.20', '2.9.1', 'Other project operating costs') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.1.21', '2.9.1', 'Support enhancement of Trade in livestock and livestock products, amid PPR eradication') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.1.21.00', '2.9.1.21', 'Support enhancement of Trade in livestock and livestock products, amid PPR eradication', 'Number of analytical outputs developed') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.1.21.00_PA', '2.9.1.21.00', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;

-- Logframe 2.9.2
INSERT INTO animal_health.paid_logframes (code, project_code, label) VALUES ('2.9.2', 'PPR', '# of RECs whose capacities are strengthened to eradicate PPR') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.2.01', '2.9.2', 'Reinforce the roles of the Regional Animal Health Networks (RAHNs)') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.2.01.00', '2.9.2.01', 'Reinforce the roles of the Regional Animal Health Networks (RAHNs)', 'Number of regional networks strengthened') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.2.01.00_PA', '2.9.2.01.00', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.2.02', '2.9.2', 'Support Regional Advisory Groups (RAGs)') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) VALUES ('2.9.2.02.00', '2.9.2.02', 'Support Regional Advisory Groups (RAGs)', 'Number of coordination platforms supported') ON CONFLICT (code) DO NOTHING;
INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) VALUES ('2.9.2.02.00_PA', '2.9.2.02.00', 'Coordination meeting', 'report') ON CONFLICT (code) DO NOTHING;

INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) VALUES ('2.9.2.03', '2.9.2', 'Project staff costs') ON CONFLICT (code) DO NOTHING;
