\c postgres

CREATE USER sayunsuperuser with superuser login encrypted password 's@yun';
DROP DATABASE IF EXISTS spis;
CREATE DATABASE spis WITH OWNER sayunsuperuser;

\c spis

\i 'C:/Program Files (x86)/PostgreSQL/9.5/share/extension/pgcrypto--1.2.sql'
CREATE EXTENSION pgcrypto;

CREATE TYPE titletypes as ENUM (
	'Ms.',
	'Mr.',
	'Mrs.',
	'Dr.',
	'Prof.',
	'Engr.',
	'Atty.');

CREATE TYPE usertypes as ENUM (
	'Admin', 'Doctor', 'Secretary'
);

CREATE TYPE sextypes AS ENUM ('M', 'F');

CREATE TYPE institutiontype AS ENUM (
	'Clinic', 'Hospital', 'Laboratory', 'Others'
);

CREATE TABLE SPIS_Instance (
	licence_no serial NOT NULL PRIMARY KEY,
	description text
);

CREATE TABLE User_Account (
	username varchar(20) NOT NULL PRIMARY KEY,
	first_name varchar(30) NOT NULL,
	middle_name varchar(30) NOT NULL,
	last_name varchar(30) NOT NULL,
	suffix varchar(10),
	title titletypes NOT NULL,
	contact_number varchar(15) NOT NULL,
	email varchar(30),
	usertype usertypes default 'Secretary' NOT NULL,
	password text NOT NULL,
	md5 text NOT NULL,
	spis_instance integer NOT NULL REFERENCES SPIS_Instance(licence_no)
);

CREATE TABLE Doctor (
	username varchar(20) NOT NULL REFERENCES User_Account(username) PRIMARY KEY,
	licence_no varchar(15) UNIQUE NOT NULL,
	ptr_no varchar(15) UNIQUE NOT NULL,
	s2_licence_no varchar(15) UNIQUE NOT NULL,
);

CREATE TABLE Secretary (
	username varchar(20) NOT NULL REFERENCES User_Account(username) PRIMARY KEY
);

CREATE TABLE Doctor_Secretary_Rel (
	doctor_username varchar(20) NOT NULL REFERENCES Doctor(username),
	Secretary_username varchar(20) NOT NULL REFERENCES Doctor(username)
);

CREATE TABLE Patient (
	id varchar(13) NOT NULL PRIMARY KEY,
	first_name varchar(30) NOT NULL,
	middle_name varchar(30) NOT NULL,
	last_name varchar(30) NOT NULL,
	suffix varchar(10),
	registration_date date NOT NULL,
	birthday date NOT NULL,
	nationality text NOT NULL,
	address text NOT NULL,
	contact_number varchar(15) NOT NULL,
	email varchar(30),
	contact_number2 varchar(15),
	emergency_contact_person varchar(60) NOT NULL,
	relationship_to_ecp varchar(30) NOT NULL,
	ecp_contact_no varchar(15) NOT NULL,
	allegies_to_food text,
	personal_health_history text,
	immediate_family_health_history text,
	previous_medical_procedure text,
	general_notes text,
	photo varchar(100)
);

CREATE TABLE Hospital (
	name varchar(100) NOT NULL PRIMARY KEY,
	address text NOT NULL,
	type institutiontype default 'Laboratory',
	active boolean default true,
	contact_numbers varchar(15)[]
);

CREATE TABLE In_Patient_Treatment (
	id serial NOT NULL PRIMARY KEY,
	patient_id varchar(13) NOT NULL REFERENCES Patient(id),
	doctor_username varchar(20) NOT NULL REFERENCES Doctor(username),
	hospital varchar(100) NOT NULL REFERENCES Hospital(name),
	confinement_date date NOT NULL default CURRENT_DATE,
	discharge_date date
);

CREATE TABLE Out_Patient_Treatment (
	id serial NOT NULL PRIMARY KEY,
	patient_id varchar(13) NOT NULL REFERENCES Patient(id),
	doctor_username varchar(20) NOT NULL REFERENCES Doctor(username),
	hospital varchar(100) NOT NULL REFERENCES Hospital(name),
	date_checked date NOT NULL default CURRENT_DATE
);

CREATE TABLE Lab_Results (
	id serial NOT NULL PRIMARY KEY,
	date_checked date NOT NULL default CURRENT_DATE,
	hospital varchar(100) NOT NULL REFERENCES Hospital(name),
	patient_id varchar(13) NOT NULL REFERENCES Patient(id),
	description text NOT NULL
);

CREATE FUNCTION generate_patient_id() RETURNS trigger AS 
$func$
	DECLARE
		month text;
		year text;
		partial_id text;
		temp text;
		counter integer;
	BEGIN
		SELECT EXTRACT(MONTH FROM CURRENT_DATE) INTO month;
		SELECT EXTRACT(YEAR FROM CURRENT_DATE) INTO year;
		IF length(month::text) = 1 THEN
			month := concat('0', month::text);
		END IF;
		IF length(year::text) <> 2 THEN
			year := year::text;
			year := substring(year from 3 for 2);
		END IF;
		partial_id := concat(year::text, '-', month::text, '-');
		SELECT id INTO temp FROM Patient WHERE id LIKE concat(partial_id, '%') ORDER BY id DESC LIMIT 1;
		IF temp is NULL THEN
			counter := 0;
		ELSE
			temp := substring(temp::text from 8 for 7);
			counter := NULLIF(temp, '')::int;
		END IF;

		IF counter = 0 THEN
			NEW.id := concat(partial_id, repeat('0', 7-length((counter+1)::text)), (counter+1)::text);
		ELSE 
			NEW.id := concat(partial_id, repeat('0', 7-length((counter+1)::text)), (counter+1)::text);
		END IF;
		RETURN NEW;
	END;
$func$  LANGUAGE plpgsql;

CREATE TRIGGER patient_id BEFORE INSERT ON Patient FOR EACH ROW EXECUTE PROCEDURE generate_patient_id();

INSERT INTO Patient (id, first_name, middle_name, last_name, registration_date, 
	birthday, nationality, address, contact_number, emergency_contact_person, 
	relationship_to_ecp, ecp_contact_no) VALUES ('1', 'Arvin', 'Sale', 'Arbuis', 
	CURRENT_DATE, '1998-04-25', 'Filipino', 'Labangon, Cebu City', '09330612892', 'Teresita Arbuis',
	'Mother', '09239374917');
INSERT INTO Patient (id, first_name, middle_name, last_name, registration_date, 
	birthday, nationality, address, contact_number, emergency_contact_person, 
	relationship_to_ecp, ecp_contact_no, email) VALUES ('1', 'Mae Celine', 'Cerino', 'Erasmo', 
	CURRENT_DATE, '1997-11-03', 'Filipino', 'Guadalupe, Cebu City', '09330612892', 'Trisha Butas',
	'Friend', '09239374917', 'mcerasmo@up.edu.ph');
INSERT INTO Patient (id, first_name, middle_name, last_name, registration_date, 
	birthday, nationality, address, contact_number, emergency_contact_person, 
	relationship_to_ecp, ecp_contact_no, allegies_to_food, personal_health_history, email) VALUES ('1', 'Melissa', 'Sale', 'Arbuis', 
	CURRENT_DATE, '1999-08-09', 'Filipino', 'Labangon, Cebu City', '09330612892', 'Teresita Arbuis',
	'Mother', '09239374917', 'Shrimp and Squid', 'Had dengue once and an apendectomy', 'melissa_arbuis09@gmail.com');

INSERT INTO SPIS_Instance (description) VALUES ('Bernard Lees Clinic');
INSERT INTO SPIS_Instance (description) VALUES ('Sample Clinic');
INSERT INTO SPIS_Instance (description) VALUES ('ChongHua Clinic');

INSERT INTO User_Account VALUES ('doc_james', 'James', 'Go', 'Uy', 'Jr.', 'Dr.', '09123456789', 
	'jamesgu@gmail.com', 'Doctor', crypt('qwerty123', gen_salt('md5')), md5('qwerty123'), 1);
INSERT INTO User_Account VALUES ('drbean', 'Bean', 'Salas', 'Sabal', 'III', 'Dr.', '09987654321', 
	'Drbean@gmail.com', 'Doctor', crypt('qwerty123', gen_salt('md5')), md5('qwerty123'), 2);
INSERT INTO User_Account (username, first_name, middle_name, last_name, title, contact_number, email, password, md5, spis_instance) VALUES 
	('mbarnado', 'Ma. Cristina', 'Borbon', 'Arnado', 'Mrs.', '09232323232', 
	'cristinaarnado@gmail.com', crypt('qwerty123', gen_salt('md5')), md5('qwerty123'), 2);
INSERT INTO User_Account (username, first_name, middle_name, last_name, title, contact_number, email, password, md5, spis_instance) VALUES 
	('pmarts', 'Patrick', 'Aragon', 'Martinez', 'Mr.', '09242857393', 
	'patrickm@gmail.com', crypt('qwerty123', gen_salt('md5')), md5('qwerty123'), 3);

INSERT INTO Hospital VALUES ('Chong Hua Hospital', 'Don Mariano Cui Street, Fuente Osmeña, Cebu City, 6000', 'Hospital', true, '{"(032) 255 8000"}');
INSERT INTO Hospital VALUES ('Perpetual Succour Hospital', 'Gorordo Ave, Cebu City, 6000 Cebu', 'Hospital', true, '{"(032) 233 8620"}');
INSERT INTO Hospital VALUES ('Cebu Doctor''s University Hospital', 'Osmeña Blvd, Cebu City, 6000 Cebu', 'Hospital', true, '{"(032) 255 5555"}');
INSERT INTO Hospital VALUES ('Vicente Sotto Memorial Medical Center', 'B. Rodriguez St, Cebu City, Cebu', 'Hospital', true, '{"(032) 255 5555"}');
INSERT INTO Hospital VALUES ('Cebu North General Hospital', 'Kauswagan Rd, Cebu City, 6000 Cebu', 'Hospital', true, '{"(032) 253 9898"}');
INSERT INTO Hospital VALUES ('Miller Hospital', 'Tres de Abril St., Cebu City, 6000 Cebu', 'Hospital', true, '{"(032) 261 2100"}');
INSERT INTO Hospital VALUES ('Cebu Velez General Hospital', 'F. Ramos St, Cebu City, Cebu', 'Hospital', true, '{"(032) 253 1871"}');
INSERT INTO Hospital VALUES ('Sacred Heart Hospital', '53 J. Urgello St, Cebu City, 6000 Cebu', 'Hospital', true, '{"(032) 418 8412"}');
INSERT INTO Hospital VALUES ('Cebu Puericulture Center & Maternity House, Inc.', 'B. Rodriguez St, Cebu City, Cebu', 'Hospital', true, '{}');
INSERT INTO Hospital VALUES ('Cebu City Medical Center', 'Natalio B. Bacalso Ave, Cebu City, Cebu', 'Hospital', true, '{"(032) 255 7274"}');
INSERT INTO Hospital VALUES ('St. Vincent General Hospital', '210 Jones Ave, Cebu City, Cebu', 'Hospital', true, '{"(032) 238 0000"}');
INSERT INTO Hospital VALUES ('Visayas Community Medical Center', 'Osmeña Blvd, Cebu City, 6000 Cebu', 'Hospital', true, '{"(032) 253 1901"}');
INSERT INTO Hospital VALUES ('Mandaue City Hospital', 'Mandaue City, Cebu', 'Hospital', true, '{"(032) 345 9739"}');

INSERT INTO Secretary VALUES ('mbarnado'), ('pmarts');
INSERT INTO Doctor VALUES ('doc_james', '111-1111-111', '111-1111-111', '111-1111-111'), ('drbean', '222-2222-222', '222-2222-222', '222-2222-222');

INSERT INTO User_Accounts (id, first_name, middle_name, last_name, contact_number, email, password, md5, spis_instance) VALUES 
	('pmarts', 'Patrick', 'Aragon', 'Martinez', 'Mr.', '09242857393', 
	'patrickm@gmail.com', crypt('qwerty123', gen_salt('md5')), md5('qwerty123'), 3);

	insert into spis_instances (description, "createdAt", "updatedAt") values ('Bernard Lees Clinic', now(), now());
	insert into spis_instances (description, "createdAt", "updatedAt") values ('ChongHua Clinic', now(), now());
	insert into superusers values ('sayunsuperuser', 's@yun', '+639062494175', 'sales@sayunsolutions.com', now(), now());