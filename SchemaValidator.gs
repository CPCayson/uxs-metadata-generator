//SchemaValidator.gs
const ISO_SCHEMAS = {
  'iso19115-2': {
    version: '19139',
    name: 'ISO 19115-2 (ISO 19139 encoding)',
    namespaces: {
      'gmd': 'http://www.isotc211.org/2005/gmd',
      'gco': 'http://www.isotc211.org/2005/gco',
      'gmi': 'http://www.isotc211.org/2005/gmi',
      'gml': 'http://www.opengis.net/gml/3.2',
      'gmx': 'http://www.isotc211.org/2005/gmx',
      'xlink': 'http://www.w3.org/1999/xlink',
      'xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    },
    noaaCodelistBase:
      'https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#',
    nceiMetadataContactHref:
      'https://data.noaa.gov/docucomp/440b3ac2-64a5-46e2-9846-38305718b644',
    rootElement: 'gmi:MI_Metadata',
    schemaLocation: 'http://www.isotc211.org/2005/gmi http://www.isotc211.org/2005/gmi/gmi.xsd'
  }
};

/** NOAA / ACDO / NCEI docucomp license options for gmd:resourceConstraints (see Navy UxS template + Metadata WG guidance). */
const NOAA_CC0_ACDO_ANCHOR_BLOCKS = [
  {
    href: 'https://creativecommons.org/publicdomain/zero/1.0',
    title: 'CC0-1.0',
    text:
      'These data were produced by NOAA and are not subject to copyright protection in the United States. NOAA waives any potential copyright and related rights in these data worldwide through the Creative Commons Zero 1.0 Universal Public Domain Dedication (CC0-1.0).'
  },
  {
    href: 'https://spdx.org/licenses/CC0-1.0',
    title: 'CC0-1.0',
    text: 'SPDX License: Creative Commons Zero v1.0 Universal (CC0-1.0)'
  }
];

const NOAA_DATA_LICENSE_PRESET_DEFS = {
  custom: { anchors: [], docucompHref: null },
  cc0_acdo: { anchors: NOAA_CC0_ACDO_ANCHOR_BLOCKS, docucompHref: null },
  ncei_cc0: { anchors: [], docucompHref: 'https://data.noaa.gov/docucomp/10bb305d-f440-4b92-8c1c-759dd543bc51' },
  ncei_cc_by_4: { anchors: [], docucompHref: 'https://data.noaa.gov/docucomp/551ecbfb-70c4-43a9-b361-3bf9fea67a75' },
  ncei_cc0_internal_noaa: { anchors: [], docucompHref: 'https://data.noaa.gov/docucomp/493b9ff1-4465-404d-bcdf-e0fe1cedb14f' },
  cc0_acdo_and_ncei: { anchors: NOAA_CC0_ACDO_ANCHOR_BLOCKS, docucompHref: 'https://data.noaa.gov/docucomp/10bb305d-f440-4b92-8c1c-759dd543bc51' }
};

function normalizeDataLicensePresetKey_(raw) {
  const s = String(raw || 'custom')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  return NOAA_DATA_LICENSE_PRESET_DEFS[s] ? s : 'custom';
}

/** GCMD concept scheme shortName → ISO 19139 MD_KeywordTypeCode codeListValue (NOAA UxS template). */
function gcmdSchemeToKeywordTypeCode_(schemeShort) {
  const s = String(schemeShort || '')
    .trim()
    .toLowerCase();
  const map = {
    sciencekeywords: 'theme',
    locations: 'place',
    platforms: 'platform',
    instruments: 'instrument',
    projects: 'project',
    providers: 'dataCentre',
    datacenters: 'dataCentre'
  };
  return map[s] || 'theme';
}

class XMLGenerationError extends Error {
  constructor(message, type = 'unknown', context = {}) {
    super(message);
    this.name = 'XMLGenerationError';
    this.type = type;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

function getSchemaConversionDiagnostics(sourceSchema, targetSchema) {
  const source = String(sourceSchema || '').toLowerCase();
  const target = String(targetSchema || '').toLowerCase();

  return {
    sourceSchema: source,
    targetSchema: target,
    mappingKey: `${source}_to_${target}`,
    bestEffort: false,
    unmappedSourcePaths: [],
    collisionWarnings: [],
    warning: null
  };
}

class UniversalXMLGenerator {
  constructor(schema = 'iso19115-2') {
    this.schema = ISO_SCHEMAS[schema] || ISO_SCHEMAS['iso19115-2'];
  }

  generate(data) {
    try {
      Logger.log(`INFO: UniversalXMLGenerator - Generating ISO 19115-2 XML`);
      const doc = XmlService.createDocument();
      const root = XmlService.createElement('MI_Metadata', XmlService.getNamespace(this.schema.namespaces.gmi));
      doc.setRootElement(root);

      // Skip namespace attributes - they cause setAttribute errors in Google Apps Script
      // The namespaces are already embedded in elements via XmlService.getNamespace()
      Logger.log('INFO: UniversalXMLGenerator - Skipping namespace attributes to avoid setAttribute errors');

      this.addMetadataIdentifier(doc, root, data);
      this.addLanguage(doc, root, data);
      this.addHierarchyLevel(doc, root, data);
      this.addContact(doc, root, data);
      this.addDateInfo(doc, root, data);
      this.addMetadataStandard(doc, root, data);
      this.addSpatialRepresentationInfo(doc, root, data);
      if (!data.output || data.output.omitRootReferenceSystemInfo !== true) {
        this.addReferenceSystemInfo(doc, root, data);
      }
      this.addIdentificationInfo(doc, root, data);
      this.addContentInfo(doc, root, data);
      this.addDistributionInfo(doc, root, data);
      this.addDataQualityInfo(doc, root, data);
      this.addMetadataMaintenanceRoot(doc, root, data);
      this.addAcquisitionInfo(doc, root, data);

      let xmlString = XmlService.getPrettyFormat().format(doc);
      Logger.log(`INFO: UniversalXMLGenerator - ISO 19115-2 XML generated successfully`);

      // Add schema information to the root element for ISO 19115-2
      xmlString = xmlString.replace(
        /<([A-Za-z_][\w.-]*:)?MI_Metadata\b[^>]*>/,
        `<gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"
    xmlns:gco="http://www.isotc211.org/2005/gco" xmlns:gmd="http://www.isotc211.org/2005/gmd"
    xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:gmx="http://www.isotc211.org/2005/gmx"
    xmlns:gsr="http://www.isotc211.org/2005/gsr" xmlns:gss="http://www.isotc211.org/2005/gss"
    xmlns:gts="http://www.isotc211.org/2005/gts" xmlns:srv="http://www.isotc211.org/2005/srv"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.isotc211.org/2005/gmi https://data.noaa.gov/resources/iso19139/schema.xsd">`
      );
      xmlString = xmlString.replace(/<\/([A-Za-z_][\w.-]*:)?MI_Metadata>/, '</gmi:MI_Metadata>');

      Logger.log(`INFO: UniversalXMLGenerator - ISO 19115-2 schema information added to XML`);
      return xmlString;
    } catch (error) {
      Logger.log(`ERROR: UniversalXMLGenerator - ISO 19115-2 generation failed: ${error.message}`);
      throw new XMLGenerationError(`ISO 19115-2 XML generation failed: ${error.message}`, 'generation', { originalError: error });
    }
  }

  /**
   * XmlService requires prefix+URI for xlink (and gco) when calling setAttribute(name, value, namespace);
   * URI-only getNamespace(uri) often throws on setAttribute in the Apps Script runtime.
   */
  xlinkNamespace_() {
    return XmlService.getNamespace('xlink', this.schema.namespaces.xlink);
  }

  gcoAttrNamespace_() {
    return XmlService.getNamespace('gco', this.schema.namespaces.gco);
  }

  createElement(doc, namespace, localName, textContent = null) {
    const element = XmlService.createElement(localName, XmlService.getNamespace(this.schema.namespaces[namespace]));
    if (textContent !== null && textContent !== undefined && textContent !== '') {
      element.setText(String(textContent));
    }
    return element;
  }

  createCharacterString(doc, text) {
    return this.createElement(doc, 'gco', 'CharacterString', text);
  }

  createDecimal(doc, value) {
    return this.createElement(doc, 'gco', 'Decimal', value);
  }

  createInteger(doc, value) {
    return this.createElement(doc, 'gco', 'Integer', value);
  }

  createDateTime(doc, dateValue) {
    if (!dateValue) return null;
    try {
      const isoDate = new Date(dateValue).toISOString();
      return this.createElement(doc, 'gco', 'DateTime', isoDate);
    } catch (e) {
      Logger.log(`WARN: createDateTime - Invalid date: ${dateValue}, skipping`);
      return null;
    }
  }

  createGcoDate(doc, dateValue) {
    if (!dateValue) return null;
    try {
      const day = new Date(dateValue).toISOString().slice(0, 10);
      return this.createElement(doc, 'gco', 'Date', day);
    } catch (e) {
      Logger.log(`WARN: createGcoDate - Invalid date: ${dateValue}, skipping`);
      return null;
    }
  }

  createNoaaCodelistElement(doc, namespaceKey, localName, codeListValue, displayText) {
    const el = XmlService.createElement(localName, XmlService.getNamespace(this.schema.namespaces[namespaceKey]));
    const base = this.schema.noaaCodelistBase;
    el.setAttribute('codeList', base + localName);
    el.setAttribute('codeListValue', codeListValue);
    el.setText(displayText != null && displayText !== '' ? String(displayText) : String(codeListValue));
    return el;
  }

  createMeasureFromResolution(doc, resolutionText) {
    const raw = String(resolutionText || '').trim();
    if (!raw) return null;
    const parts = raw.split(/\s+/).filter(Boolean);
    let val = raw;
    let uom = 'unknown';
    const firstNum = parseFloat(parts[0]);
    if (!isNaN(firstNum) && parts.length >= 2) {
      val = String(firstNum);
      uom = parts.slice(1).join(' ');
    } else if (!isNaN(firstNum)) {
      val = String(firstNum);
      uom = 'unknown';
    }
    const measure = XmlService.createElement('Measure', XmlService.getNamespace(this.schema.namespaces.gco));
    measure.setAttribute('uom', uom);
    measure.setText(val);
    return measure;
  }

  nceiPrefixedFileIdentifier_(id, data) {
    const s = String(id || '').trim();
    if (!s) return s;
    const out = data.output || {};
    if (out.nceiFileIdPrefix === false || out.skipNceiFileIdPrefix === true) return s;
    if (/^gov\.noaa\.ncei\.uxs:/i.test(s)) return s;
    return 'gov.noaa.ncei.uxs:' + s;
  }

  createGmxAnchor(doc, href, title, textContent) {
    const anchor = XmlService.createElement('Anchor', XmlService.getNamespace(this.schema.namespaces.gmx));
    const xlinkNs = this.xlinkNamespace_();
    if (href) anchor.setAttribute('href', String(href), xlinkNs);
    if (title) anchor.setAttribute('title', String(title), xlinkNs);
    anchor.setAttribute('actuate', 'onRequest', xlinkNs);
    anchor.setText(textContent != null ? String(textContent) : '');
    return anchor;
  }

  addResourceConstraintsDocucompXlink(doc, dataIdentification, href, title) {
    if (!href || !String(href).trim()) return;
    const rc = this.createElement(doc, 'gmd', 'resourceConstraints');
    const xlinkNs = this.xlinkNamespace_();
    rc.setAttribute('href', String(href).trim(), xlinkNs);
    rc.setAttribute('title', String(title || 'Data License Statement'), xlinkNs);
    dataIdentification.addContent(rc);
  }

  addOptionalRorOnlineResource(doc, ciContact, data) {
    const m = data.mission || {};
    let ror = String(m.organizationRorUri || '').trim();
    if (!ror && String(m.organizationRorId || '').trim()) {
      ror = `https://ror.org/${String(m.organizationRorId).trim()}`;
    }
    if (!ror) return;
    const onlineResource = this.createElement(doc, 'gmd', 'onlineResource');
    const ciOnlineResource = this.createElement(doc, 'gmd', 'CI_OnlineResource');
    const linkage = this.createElement(doc, 'gmd', 'linkage');
    linkage.addContent(this.createElement(doc, 'gmd', 'URL', ror));
    ciOnlineResource.addContent(linkage);
    const name = this.createElement(doc, 'gmd', 'name');
    name.addContent(this.createCharacterString(doc, 'ROR registry'));
    ciOnlineResource.addContent(name);
    const description = this.createElement(doc, 'gmd', 'description');
    description.addContent(
      this.createCharacterString(doc, 'Research Organization Registry identifier for the responsible organization')
    );
    ciOnlineResource.addContent(description);
    onlineResource.addContent(ciOnlineResource);
    ciContact.addContent(onlineResource);
  }

  inferUrlProtocol_(url) {
    const u = String(url || '')
      .trim()
      .toLowerCase();
    if (u.indexOf('https://') === 0) return 'HTTPS';
    if (u.indexOf('http://') === 0) return 'HTTP';
    if (u.indexOf('ftp://') === 0) return 'FTP';
    return '';
  }

  /** NOAA template-style CI_OnlineResource for organization website (protocol, applicationProfile, name, description, function). */
  addFullOrganizationOnlineResource(doc, ciContact, m) {
    const url = String(m.contactUrl || '').trim();
    if (!url) return;
    const onlineResource = this.createElement(doc, 'gmd', 'onlineResource');
    const ciOnlineResource = this.createElement(doc, 'gmd', 'CI_OnlineResource');
    const linkage = this.createElement(doc, 'gmd', 'linkage');
    linkage.addContent(this.createElement(doc, 'gmd', 'URL', url));
    ciOnlineResource.addContent(linkage);
    const proto =
      String(m.contactUrlProtocol || '')
        .trim() || this.inferUrlProtocol_(url);
    if (proto) {
      const p = this.createElement(doc, 'gmd', 'protocol');
      p.addContent(this.createCharacterString(doc, proto));
      ciOnlineResource.addContent(p);
    }
    const appProf =
      String(m.contactApplicationProfile || '')
        .trim() || 'web browser';
    const ap = this.createElement(doc, 'gmd', 'applicationProfile');
    ap.addContent(this.createCharacterString(doc, appProf));
    ciOnlineResource.addContent(ap);
    const orgStr = m.organization ? String(m.organization).trim() : '';
    const resName =
      String(m.contactUrlResourceName || '')
        .trim() ||
      (orgStr ? `${orgStr.slice(0, 200)} website` : 'Organization website');
    const n = this.createElement(doc, 'gmd', 'name');
    n.addContent(this.createCharacterString(doc, resName));
    ciOnlineResource.addContent(n);
    const resDesc =
      String(m.contactUrlResourceDescription || '')
        .trim() || 'Website for the responsible organization.';
    const d = this.createElement(doc, 'gmd', 'description');
    d.addContent(this.createCharacterString(doc, resDesc));
    ciOnlineResource.addContent(d);
    const fn = this.createElement(doc, 'gmd', 'function');
    fn.addContent(
      this.createNoaaCodelistElement(doc, 'gmd', 'CI_OnLineFunctionCode', 'information', 'information')
    );
    ciOnlineResource.addContent(fn);
    onlineResource.addContent(ciOnlineResource);
    ciContact.addContent(onlineResource);
  }

  /**
   * CI_ResponsibleParty for mission contact (metadata root or dataset pointOfContact) or citation author/originator.
   * Requires contact email and at least one of individualName or organisationName.
   */
  buildMissionCiResponsibleParty(doc, data, roleCodeValue) {
    const m = data.mission || {};
    const hasInd = !!(m.contactIndividualName && String(m.contactIndividualName).trim());
    const hasOrg = !!(m.organization && String(m.organization).trim());
    if (!hasInd && !hasOrg) return null;
    if (!m.contactEmail || !String(m.contactEmail).trim()) return null;

    const responsibleParty = this.createElement(doc, 'gmd', 'CI_ResponsibleParty');
    if (hasInd) {
      const ind = this.createElement(doc, 'gmd', 'individualName');
      ind.addContent(this.createCharacterString(doc, String(m.contactIndividualName).trim()));
      responsibleParty.addContent(ind);
    }
    if (hasOrg) {
      const orgName = this.createElement(doc, 'gmd', 'organisationName');
      orgName.addContent(this.createCharacterString(doc, String(m.organization).trim()));
      responsibleParty.addContent(orgName);
    }

    const contactInfo = this.createElement(doc, 'gmd', 'contactInfo');
    const ciContact = this.createElement(doc, 'gmd', 'CI_Contact');
    if (m.contactPhone) {
      const phone = this.createElement(doc, 'gmd', 'phone');
      const ciTelephone = this.createElement(doc, 'gmd', 'CI_Telephone');
      const number = this.createElement(doc, 'gmd', 'voice');
      number.addContent(this.createCharacterString(doc, m.contactPhone));
      ciTelephone.addContent(number);
      phone.addContent(ciTelephone);
      ciContact.addContent(phone);
    }
    const address = this.createElement(doc, 'gmd', 'address');
    const ciAddress = this.createElement(doc, 'gmd', 'CI_Address');
    if (m.contactAddress) {
      const deliveryPoint = this.createElement(doc, 'gmd', 'deliveryPoint');
      deliveryPoint.addContent(this.createCharacterString(doc, m.contactAddress));
      ciAddress.addContent(deliveryPoint);
    }
    const email = this.createElement(doc, 'gmd', 'electronicMailAddress');
    email.addContent(this.createCharacterString(doc, m.contactEmail));
    ciAddress.addContent(email);
    address.addContent(ciAddress);
    ciContact.addContent(address);
    this.addFullOrganizationOnlineResource(doc, ciContact, m);
    this.addOptionalRorOnlineResource(doc, ciContact, data);
    contactInfo.addContent(ciContact);
    responsibleParty.addContent(contactInfo);
    const role = this.createElement(doc, 'gmd', 'role');
    role.addContent(
      this.createNoaaCodelistElement(doc, 'gmd', 'CI_RoleCode', roleCodeValue, roleCodeValue)
    );
    responsibleParty.addContent(role);
    return responsibleParty;
  }

  /** Citation-level responsible parties per NOAA UxS template: author, publisher (NCEI), originator. */
  addCitedResponsiblePartiesToCitation(doc, ciCitation, data) {
    const m = data.mission || {};
    const authorParty = this.buildMissionCiResponsibleParty(doc, data, 'author');
    if (!authorParty) return;

    const wA = this.createElement(doc, 'gmd', 'citedResponsibleParty');
    wA.addContent(authorParty);
    ciCitation.addContent(wA);

    const pubOrg =
      String(m.citationPublisherOrganization || '')
        .trim() || 'NOAA National Centers for Environmental Information';
    const wP = this.createElement(doc, 'gmd', 'citedResponsibleParty');
    const pubParty = this.createElement(doc, 'gmd', 'CI_ResponsibleParty');
    const pn = this.createElement(doc, 'gmd', 'organisationName');
    pn.addContent(this.createCharacterString(doc, pubOrg));
    pubParty.addContent(pn);
    const pr = this.createElement(doc, 'gmd', 'role');
    pr.addContent(this.createNoaaCodelistElement(doc, 'gmd', 'CI_RoleCode', 'publisher', 'publisher'));
    pubParty.addContent(pr);
    wP.addContent(pubParty);
    ciCitation.addContent(wP);

    const origParty = this.buildMissionCiResponsibleParty(doc, data, 'originator');
    if (origParty) {
      const wO = this.createElement(doc, 'gmd', 'citedResponsibleParty');
      wO.addContent(origParty);
      ciCitation.addContent(wO);
    }
  }

  addMetadataIdentifier(doc, root, data) {
    if (!data.mission?.id) return;
    const fileId = this.createElement(doc, 'gmd', 'fileIdentifier');
    fileId.addContent(this.createCharacterString(doc, this.nceiPrefixedFileIdentifier_(data.mission.id, data)));
    root.addContent(fileId);
  }

  addLanguage(doc, root, data) {
    const language = this.createElement(doc, 'gmd', 'language');
    const raw = String(data.mission?.language || '').trim();
    const langStr =
      !raw || raw.toLowerCase() === 'eng' ? 'eng; USA' : raw;
    language.addContent(this.createCharacterString(doc, langStr));
    root.addContent(language);

    const charSet = this.createElement(doc, 'gmd', 'characterSet');
    charSet.addContent(this.createElement(doc, 'gmd', 'MD_CharacterSetCode', data.mission?.characterSet || 'utf8'));
    root.addContent(charSet);
  }

  addHierarchyLevel(doc, root, data) {
    const hierarchyLevel = this.createElement(doc, 'gmd', 'hierarchyLevel');
    const scopeVal = data.mission?.scopeCode || 'dataset';
    hierarchyLevel.addContent(this.createNoaaCodelistElement(doc, 'gmd', 'MD_ScopeCode', scopeVal, scopeVal));
    root.addContent(hierarchyLevel);
  }

  addContact(doc, root, data) {
    const out = data.output || {};
    if (out.useNceiMetadataContactXlink === true) {
      const contact = this.createElement(doc, 'gmd', 'contact');
      const xlinkNs = this.xlinkNamespace_();
      const href = String(out.nceiMetadataContactHref || this.schema.nceiMetadataContactHref || '').trim();
      if (href) contact.setAttribute('href', href, xlinkNs);
      contact.setAttribute('title', String(out.nceiMetadataContactTitle || 'NCEI (pointOfContact)'), xlinkNs);
      root.addContent(contact);
      return;
    }

    const rp = this.buildMissionCiResponsibleParty(doc, data, 'pointOfContact');
    if (!rp) return;
    const contact = this.createElement(doc, 'gmd', 'contact');
    contact.addContent(rp);
    root.addContent(contact);
  }

  addDateInfo(doc, root, data) {
    const stampSource =
      data.mission?.metadataRecordDate ||
      data.output?.metadataRecordDate ||
      new Date().toISOString();
    const dateStamp = this.createElement(doc, 'gmd', 'dateStamp');
    let dateTime = this.createDateTime(doc, stampSource);
    if (!dateTime) {
      dateTime = this.createDateTime(doc, new Date().toISOString());
    }
    if (dateTime) {
      dateStamp.addContent(dateTime);
      root.addContent(dateStamp);
    }
  }

  addMetadataStandard(doc, root, data) {
    const metadataStandardName = this.createElement(doc, 'gmd', 'metadataStandardName');
    metadataStandardName.addContent(
      this.createCharacterString(
        doc,
        data.output?.metadataStandard ||
          'ISO 19115-2 Geographic Information - Metadata - Part 2: Extensions for Imagery and Gridded Data'
      )
    );
    root.addContent(metadataStandardName);

    const metadataStandardVersion = this.createElement(doc, 'gmd', 'metadataStandardVersion');
    metadataStandardVersion.addContent(
      this.createCharacterString(doc, data.output?.metadataVersion || 'ISO 19115-2:2009(E)')
    );
    root.addContent(metadataStandardVersion);
  }

  addReferenceSystemInfo(doc, root, data) {
    const referenceSystemInfo = this.createElement(doc, 'gmd', 'referenceSystemInfo');
    const referenceSystem = this.createElement(doc, 'gmd', 'MD_ReferenceSystem');
    const referenceSystemIdentifier = this.createElement(doc, 'gmd', 'referenceSystemIdentifier');
    const rsIdentifier = this.createElement(doc, 'gmd', 'RS_Identifier');
    const code = this.createElement(doc, 'gmd', 'code');
    code.addContent(this.createCharacterString(doc, data.spatial?.referenceSystem || 'EPSG:4326'));
    rsIdentifier.addContent(code);
    referenceSystemIdentifier.addContent(rsIdentifier);
    referenceSystem.addContent(referenceSystemIdentifier);
    referenceSystemInfo.addContent(referenceSystem);
    root.addContent(referenceSystemInfo);
  }

  addIdentificationInfo(doc, root, data) {
    if (!data.mission?.title || !data.mission?.abstract) return;

    const identificationInfo = this.createElement(doc, 'gmd', 'identificationInfo');
    const dataIdentification = this.createElement(doc, 'gmd', 'MD_DataIdentification');

    const citation = this.createElement(doc, 'gmd', 'citation');
    const ciCitation = this.createElement(doc, 'gmd', 'CI_Citation');

    const title = this.createElement(doc, 'gmd', 'title');
    title.addContent(this.createCharacterString(doc, data.mission.title));
    ciCitation.addContent(title);

    if (data.mission.alternateTitle) {
      const altTitle = this.createElement(doc, 'gmd', 'alternateTitle');
      altTitle.addContent(this.createCharacterString(doc, data.mission.alternateTitle));
      ciCitation.addContent(altTitle);
    }

    if (data.mission.startDate) {
      const date = this.createElement(doc, 'gmd', 'date');
      const ciDate = this.createElement(doc, 'gmd', 'CI_Date');
      const dateElement = this.createElement(doc, 'gmd', 'date');
      const dateTime = this.createDateTime(doc, data.mission.startDate);
      if (dateTime) {
        dateElement.addContent(dateTime);
        ciDate.addContent(dateElement);
        const dateType = this.createElement(doc, 'gmd', 'dateType');
        const dateTypeCode = this.createElement(doc, 'gmd', 'CI_DateTypeCode', 'creation');
        dateType.addContent(dateTypeCode);
        ciDate.addContent(dateType);
        date.addContent(ciDate);
        ciCitation.addContent(date);
      }
    }

    if (data.mission.endDate) {
      const date = this.createElement(doc, 'gmd', 'date');
      const ciDate = this.createElement(doc, 'gmd', 'CI_Date');
      const dateElement = this.createElement(doc, 'gmd', 'date');
      const dateTime = this.createDateTime(doc, data.mission.endDate);
      if (dateTime) {
        dateElement.addContent(dateTime);
        ciDate.addContent(dateElement);
        const dateType = this.createElement(doc, 'gmd', 'dateType');
        const dateTypeCode = this.createElement(doc, 'gmd', 'CI_DateTypeCode', 'completion');
        dateType.addContent(dateTypeCode);
        ciDate.addContent(dateType);
        date.addContent(ciDate);
        ciCitation.addContent(date);
      }
    }

    if (data.mission.publicationDate) {
      const date = this.createElement(doc, 'gmd', 'date');
      const ciDate = this.createElement(doc, 'gmd', 'CI_Date');
      const dateElement = this.createElement(doc, 'gmd', 'date');
      const dateTime = this.createDateTime(doc, data.mission.publicationDate);
      if (dateTime) {
        dateElement.addContent(dateTime);
        ciDate.addContent(dateElement);
        const dateType = this.createElement(doc, 'gmd', 'dateType');
        const dateTypeCode = this.createElement(doc, 'gmd', 'CI_DateTypeCode', 'publication');
        dateType.addContent(dateTypeCode);
        ciDate.addContent(dateType);
        date.addContent(ciDate);
        ciCitation.addContent(date);
      }
    }

    if (data.output?.doi) {
      const identifier = this.createElement(doc, 'gmd', 'identifier');
      const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
      const code = this.createElement(doc, 'gmd', 'code');
      code.addContent(this.createCharacterString(doc, data.output.doi));
      mdIdentifier.addContent(code);
      identifier.addContent(mdIdentifier);
      ciCitation.addContent(identifier);
    }

    if (data.mission?.nceiAccessionId) {
      const identifier = this.createElement(doc, 'gmd', 'identifier');
      const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
      const code = this.createElement(doc, 'gmd', 'code');
      code.addContent(this.createCharacterString(doc, data.mission.nceiAccessionId));
      mdIdentifier.addContent(code);
      identifier.addContent(mdIdentifier);
      ciCitation.addContent(identifier);
    }

    if (data.mission?.id) {
      const identifier = this.createElement(doc, 'gmd', 'identifier');
      const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
      const code = this.createElement(doc, 'gmd', 'code');
      code.addContent(this.createCharacterString(doc, data.mission.id));
      mdIdentifier.addContent(code);
      identifier.addContent(mdIdentifier);
      ciCitation.addContent(identifier);
    }

    this.addCitedResponsiblePartiesToCitation(doc, ciCitation, data);

    citation.addContent(ciCitation);
    dataIdentification.addContent(citation);

    const abstract = this.createElement(doc, 'gmd', 'abstract');
    abstract.addContent(this.createCharacterString(doc, data.mission.abstract));
    dataIdentification.addContent(abstract);

    if (data.mission.purpose) {
      const purpose = this.createElement(doc, 'gmd', 'purpose');
      purpose.addContent(this.createCharacterString(doc, data.mission.purpose));
      dataIdentification.addContent(purpose);
    }

    if (data.mission.status) {
      const status = this.createElement(doc, 'gmd', 'status');
      const progressCode = this.createElement(doc, 'gmd', 'MD_ProgressCode', data.mission.status);
      status.addContent(progressCode);
      dataIdentification.addContent(status);
    }

    const datasetPoc = this.buildMissionCiResponsibleParty(doc, data, 'pointOfContact');
    if (datasetPoc) {
      const pointOfContact = this.createElement(doc, 'gmd', 'pointOfContact');
      pointOfContact.addContent(datasetPoc);
      dataIdentification.addContent(pointOfContact);
    }

    this.addDescriptiveKeywords(doc, dataIdentification, data);

    const licensePresetKey = normalizeDataLicensePresetKey_(data.mission && data.mission.dataLicensePreset);
    const licensePreset = NOAA_DATA_LICENSE_PRESET_DEFS[licensePresetKey];
    const presetAnchors = (licensePreset && licensePreset.anchors) || [];
    const hasPlainLicenseLine =
      licensePresetKey === 'custom' && data.mission.licenseUrl && String(data.mission.licenseUrl).trim();
    const needsLegalMd =
      data.mission.accessConstraints ||
      data.mission.distributionLiability ||
      data.mission.citeAs ||
      data.mission.otherCiteAs ||
      hasPlainLicenseLine ||
      presetAnchors.length > 0;

    if (needsLegalMd) {
      const resourceConstraints = this.createElement(doc, 'gmd', 'resourceConstraints');
      const legalConstraints = this.createElement(doc, 'gmd', 'MD_LegalConstraints');
      if (data.mission.accessConstraints) {
        const accessConstraints = this.createElement(doc, 'gmd', 'accessConstraints');
        const restrictionCode = this.createElement(doc, 'gmd', 'MD_RestrictionCode', data.mission.accessConstraints);
        accessConstraints.addContent(restrictionCode);
        legalConstraints.addContent(accessConstraints);
      }
      if (data.mission.citeAs) {
        const useLimitation = this.createElement(doc, 'gmd', 'useLimitation');
        useLimitation.addContent(this.createCharacterString(doc, data.mission.citeAs));
        legalConstraints.addContent(useLimitation);
      }
      if (data.mission.distributionLiability) {
        const otherConstraints = this.createElement(doc, 'gmd', 'otherConstraints');
        otherConstraints.addContent(this.createCharacterString(doc, data.mission.distributionLiability));
        legalConstraints.addContent(otherConstraints);
      }
      if (data.mission.otherCiteAs) {
        const otherConstraints = this.createElement(doc, 'gmd', 'otherConstraints');
        otherConstraints.addContent(this.createCharacterString(doc, data.mission.otherCiteAs));
        legalConstraints.addContent(otherConstraints);
      }
      if (hasPlainLicenseLine) {
        const otherConstraints = this.createElement(doc, 'gmd', 'otherConstraints');
        otherConstraints.addContent(
          this.createCharacterString(doc, `Data license: ${String(data.mission.licenseUrl).trim()}`)
        );
        legalConstraints.addContent(otherConstraints);
      }
      presetAnchors.forEach((a) => {
        const otherConstraints = this.createElement(doc, 'gmd', 'otherConstraints');
        otherConstraints.addContent(this.createGmxAnchor(doc, a.href, a.title, a.text));
        legalConstraints.addContent(otherConstraints);
      });
      resourceConstraints.addContent(legalConstraints);
      dataIdentification.addContent(resourceConstraints);
    }

    if (licensePreset && licensePreset.docucompHref) {
      this.addResourceConstraintsDocucompXlink(
        doc,
        dataIdentification,
        licensePreset.docucompHref,
        'Data License Statement'
      );
    }

    this.addIdentificationExtents(doc, dataIdentification, data);
    this.addAggregationInfoBlocks(doc, dataIdentification, data);

    if (data.mission.supplementalInformation) {
      const supplemental = this.createElement(doc, 'gmd', 'supplementalInformation');
      supplemental.addContent(this.createCharacterString(doc, data.mission.supplementalInformation));
      dataIdentification.addContent(supplemental);
    }

    identificationInfo.addContent(dataIdentification);
    root.addContent(identificationInfo);
  }

  addIdentificationExtents(doc, dataIdentification, data) {
    const spatial = data.spatial || {};
    const mission = data.mission || {};

    const hasGeoDesc = !!(spatial.geographicDescription && String(spatial.geographicDescription).trim());
    const extentNarrativeRaw =
      String(spatial.extentDescription || spatial.geographicDescription || '')
        .trim() || '';
    const hasExtentNarrative = !!extentNarrativeRaw;
    const bbox = spatial.boundingBox;
    const lowerLeft =
      bbox &&
      (bbox.lowerLeft ||
        (bbox.west != null && bbox.south != null ? { lon: bbox.west, lat: bbox.south } : null));
    const upperRight =
      bbox &&
      (bbox.upperRight ||
        (bbox.east != null && bbox.north != null ? { lon: bbox.east, lat: bbox.north } : null));
    const hasBbox = !!(lowerLeft && upperRight);
    const hasTemporal = !!(mission.startDate || mission.endDate);
    const hasTimeInterval =
      !!(mission.temporalExtentIntervalUnit && String(mission.temporalExtentIntervalUnit).trim()) &&
      mission.temporalExtentIntervalValue !== undefined &&
      mission.temporalExtentIntervalValue !== null &&
      String(mission.temporalExtentIntervalValue).trim() !== '';
    const vmin = spatial.verticalMinimum;
    const vmax = spatial.verticalMaximum;
    const hasVertical =
      vmin !== undefined &&
      vmin !== null &&
      String(vmin).trim() !== '' &&
      vmax !== undefined &&
      vmax !== null &&
      String(vmax).trim() !== '';

    if (!hasGeoDesc && !hasExtentNarrative && !hasBbox && !hasTemporal && !hasVertical) return;

    const extent = this.createElement(doc, 'gmd', 'extent');
    const exExtent = this.createElement(doc, 'gmd', 'EX_Extent');

    if (hasExtentNarrative) {
      const desc = this.createElement(doc, 'gmd', 'description');
      desc.addContent(this.createCharacterString(doc, extentNarrativeRaw));
      exExtent.addContent(desc);
    }

    if (hasGeoDesc) {
      const geographicElement = this.createElement(doc, 'gmd', 'geographicElement');
      const exGeographicDescription = this.createElement(doc, 'gmd', 'EX_GeographicDescription');
      const geographicIdentifier = this.createElement(doc, 'gmd', 'geographicIdentifier');
      const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
      const code = this.createElement(doc, 'gmd', 'code');
      code.addContent(this.createCharacterString(doc, String(spatial.geographicDescription).trim()));
      mdIdentifier.addContent(code);
      geographicIdentifier.addContent(mdIdentifier);
      exGeographicDescription.addContent(geographicIdentifier);
      geographicElement.addContent(exGeographicDescription);
      exExtent.addContent(geographicElement);
    }

    if (hasBbox) {
      const geographicElement = this.createElement(doc, 'gmd', 'geographicElement');
      const exBoundingBox = this.createElement(doc, 'gmd', 'EX_GeographicBoundingBox');
      const westBound = this.createElement(doc, 'gmd', 'westBoundLongitude');
      westBound.addContent(this.createDecimal(doc, lowerLeft.lon != null && lowerLeft.lon !== '' ? lowerLeft.lon : ''));
      exBoundingBox.addContent(westBound);
      const eastBound = this.createElement(doc, 'gmd', 'eastBoundLongitude');
      eastBound.addContent(this.createDecimal(doc, upperRight.lon != null && upperRight.lon !== '' ? upperRight.lon : ''));
      exBoundingBox.addContent(eastBound);
      const southBound = this.createElement(doc, 'gmd', 'southBoundLatitude');
      southBound.addContent(this.createDecimal(doc, lowerLeft.lat != null && lowerLeft.lat !== '' ? lowerLeft.lat : ''));
      exBoundingBox.addContent(southBound);
      const northBound = this.createElement(doc, 'gmd', 'northBoundLatitude');
      northBound.addContent(this.createDecimal(doc, upperRight.lat != null && upperRight.lat !== '' ? upperRight.lat : ''));
      exBoundingBox.addContent(northBound);
      geographicElement.addContent(exBoundingBox);
      exExtent.addContent(geographicElement);
    }

    if (hasTemporal) {
      const temporalElement = this.createElement(doc, 'gmd', 'temporalElement');
      const exTemporal = this.createElement(doc, 'gmd', 'EX_TemporalExtent');
      const innerExtent = this.createElement(doc, 'gmd', 'extent');
      const timePeriod = XmlService.createElement('TimePeriod', XmlService.getNamespace(this.schema.namespaces.gml));
      timePeriod.setAttribute('id', 'dataAcquisitionPeriod');
      if (mission.startDate) {
        const begin = XmlService.createElement('beginPosition', XmlService.getNamespace(this.schema.namespaces.gml));
        begin.setText(new Date(mission.startDate).toISOString());
        timePeriod.addContent(begin);
      }
      if (mission.endDate) {
        const end = XmlService.createElement('endPosition', XmlService.getNamespace(this.schema.namespaces.gml));
        end.setText(new Date(mission.endDate).toISOString());
        timePeriod.addContent(end);
      }
      if (hasTimeInterval && hasTemporal) {
        const gmlNs = XmlService.getNamespace(this.schema.namespaces.gml);
        const ti = XmlService.createElement('timeInterval', gmlNs);
        ti.setAttribute('unit', String(mission.temporalExtentIntervalUnit).trim(), gmlNs);
        ti.setText(String(mission.temporalExtentIntervalValue).trim());
        timePeriod.addContent(ti);
      }
      innerExtent.addContent(timePeriod);
      exTemporal.addContent(innerExtent);
      temporalElement.addContent(exTemporal);
      exExtent.addContent(temporalElement);
    }

    if (hasVertical) {
      const verticalElement = this.createElement(doc, 'gmd', 'verticalElement');
      const exVertical = this.createElement(doc, 'gmd', 'EX_VerticalExtent');
      const minimumValue = this.createElement(doc, 'gmd', 'minimumValue');
      minimumValue.addContent(this.createDecimal(doc, Number(vmin)));
      exVertical.addContent(minimumValue);
      const maximumValue = this.createElement(doc, 'gmd', 'maximumValue');
      maximumValue.addContent(this.createDecimal(doc, Number(vmax)));
      exVertical.addContent(maximumValue);
      const vCrsXlink = spatial.verticalCrsXlinkHref && String(spatial.verticalCrsXlinkHref).trim();
      if (vCrsXlink) {
        const verticalCRS = this.createElement(doc, 'gmd', 'verticalCRS');
        const xlinkNs = this.xlinkNamespace_();
        verticalCRS.setAttribute('href', vCrsXlink, xlinkNs);
        verticalCRS.setAttribute('actuate', 'none', xlinkNs);
        exVertical.addContent(verticalCRS);
      } else if (spatial.verticalCrsUrl && String(spatial.verticalCrsUrl).trim()) {
        const verticalCRS = this.createElement(doc, 'gmd', 'verticalCRS');
        const refSystem = this.createElement(doc, 'gmd', 'MD_ReferenceSystem');
        const refId = this.createElement(doc, 'gmd', 'referenceSystemIdentifier');
        const rsId = this.createElement(doc, 'gmd', 'RS_Identifier');
        const crsCode = this.createElement(doc, 'gmd', 'code');
        crsCode.addContent(this.createCharacterString(doc, String(spatial.verticalCrsUrl).trim()));
        rsId.addContent(crsCode);
        refId.addContent(rsId);
        refSystem.addContent(refId);
        verticalCRS.addContent(refSystem);
        exVertical.addContent(verticalCRS);
      }
      verticalElement.addContent(exVertical);
      exExtent.addContent(verticalElement);
    }

    extent.addContent(exExtent);
    dataIdentification.addContent(extent);
  }

  addAggregationInfoBlocks(doc, dataIdentification, data) {
    const m = data.mission || {};

    const addAggregateBlock = (cfg) => {
      const {
        title,
        dateVal,
        citationCode,
        note,
        associationType,
        initiativeType,
        nilAggregateDataSetIdentifier,
        separatePublicationId,
        relatedOnlineResource
      } = cfg;
      if (!title || !String(title).trim()) return;

      const aggregationInfo = this.createElement(doc, 'gmd', 'aggregationInfo');
      const mdAgg = this.createElement(doc, 'gmd', 'MD_AggregateInformation');

      const aggregateDataSetName = this.createElement(doc, 'gmd', 'aggregateDataSetName');
      const ciCitation = this.createElement(doc, 'gmd', 'CI_Citation');
      const t = this.createElement(doc, 'gmd', 'title');
      t.addContent(this.createCharacterString(doc, String(title).trim()));
      ciCitation.addContent(t);
      if (note && String(note).trim()) {
        const alt = this.createElement(doc, 'gmd', 'alternateTitle');
        alt.addContent(this.createCharacterString(doc, String(note).trim()));
        ciCitation.addContent(alt);
      }
      if (dateVal) {
        const date = this.createElement(doc, 'gmd', 'date');
        const ciDate = this.createElement(doc, 'gmd', 'CI_Date');
        const dateElement = this.createElement(doc, 'gmd', 'date');
        const gcoDate = this.createGcoDate(doc, dateVal);
        if (gcoDate) {
          dateElement.addContent(gcoDate);
          ciDate.addContent(dateElement);
          const dateType = this.createElement(doc, 'gmd', 'dateType');
          dateType.addContent(this.createNoaaCodelistElement(doc, 'gmd', 'CI_DateTypeCode', 'publication', 'publication'));
          ciDate.addContent(dateType);
          date.addContent(ciDate);
          ciCitation.addContent(date);
        }
      }
      if (citationCode && String(citationCode).trim() && !separatePublicationId) {
        const identifier = this.createElement(doc, 'gmd', 'identifier');
        const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
        const c = this.createElement(doc, 'gmd', 'code');
        c.addContent(this.createCharacterString(doc, String(citationCode).trim()));
        mdIdentifier.addContent(c);
        identifier.addContent(mdIdentifier);
        ciCitation.addContent(identifier);
      }
      const relOr = relatedOnlineResource || {};
      const relUrl = relOr.url && String(relOr.url).trim();
      if (relUrl) {
        const onlineResource = this.createElement(doc, 'gmd', 'onlineResource');
        const ciOnlineResource = this.createElement(doc, 'gmd', 'CI_OnlineResource');
        const linkage = this.createElement(doc, 'gmd', 'linkage');
        linkage.addContent(this.createElement(doc, 'gmd', 'URL', relUrl));
        ciOnlineResource.addContent(linkage);
        const proto =
          String(relOr.protocol || '')
            .trim() || this.inferUrlProtocol_(relUrl);
        if (proto) {
          const p = this.createElement(doc, 'gmd', 'protocol');
          p.addContent(this.createCharacterString(doc, proto));
          ciOnlineResource.addContent(p);
        }
        const ap = this.createElement(doc, 'gmd', 'applicationProfile');
        ap.addContent(this.createCharacterString(doc, String(relOr.applicationProfile || 'web browser').trim()));
        ciOnlineResource.addContent(ap);
        if (relOr.name && String(relOr.name).trim()) {
          const n = this.createElement(doc, 'gmd', 'name');
          n.addContent(this.createCharacterString(doc, String(relOr.name).trim()));
          ciOnlineResource.addContent(n);
        }
        if (relOr.description && String(relOr.description).trim()) {
          const d = this.createElement(doc, 'gmd', 'description');
          d.addContent(this.createCharacterString(doc, String(relOr.description).trim()));
          ciOnlineResource.addContent(d);
        }
        const fn = this.createElement(doc, 'gmd', 'function');
        fn.addContent(
          this.createNoaaCodelistElement(doc, 'gmd', 'CI_OnLineFunctionCode', 'information', 'information')
        );
        ciOnlineResource.addContent(fn);
        onlineResource.addContent(ciOnlineResource);
        ciCitation.addContent(onlineResource);
      }
      aggregateDataSetName.addContent(ciCitation);
      mdAgg.addContent(aggregateDataSetName);

      if (nilAggregateDataSetIdentifier) {
        const adsi = this.createElement(doc, 'gmd', 'aggregateDataSetIdentifier');
        adsi.setAttribute('nilReason', 'missing', this.gcoAttrNamespace_());
        mdAgg.addContent(adsi);
      } else if (separatePublicationId && String(separatePublicationId).trim()) {
        const adsi = this.createElement(doc, 'gmd', 'aggregateDataSetIdentifier');
        const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
        const c = this.createElement(doc, 'gmd', 'code');
        c.addContent(this.createCharacterString(doc, String(separatePublicationId).trim()));
        mdIdentifier.addContent(c);
        adsi.addContent(mdIdentifier);
        mdAgg.addContent(adsi);
      }

      const associationTypeEl = this.createElement(doc, 'gmd', 'associationType');
      associationTypeEl.addContent(
        this.createNoaaCodelistElement(doc, 'gmd', 'DS_AssociationTypeCode', associationType, associationType)
      );
      mdAgg.addContent(associationTypeEl);

      if (initiativeType && String(initiativeType).trim()) {
        const it = this.createElement(doc, 'gmd', 'initiativeType');
        it.addContent(this.createNoaaCodelistElement(doc, 'gmd', 'DS_InitiativeTypeCode', initiativeType, initiativeType));
        mdAgg.addContent(it);
      }

      aggregationInfo.addContent(mdAgg);
      dataIdentification.addContent(aggregationInfo);
    };

    addAggregateBlock({
      title: m.parentProjectTitle,
      dateVal: m.parentProjectDate,
      citationCode: m.parentProjectCode,
      associationType: 'largerWorkCitation',
      initiativeType: 'project'
    });

    const relatedBits = [];
    if (m.relatedDatasetOrg) relatedBits.push(`Organization: ${m.relatedDatasetOrg}`);
    const relUrl = m.relatedDataUrl && String(m.relatedDataUrl).trim();
    if (relUrl) {
      addAggregateBlock({
        title: m.relatedDatasetTitle,
        dateVal: m.relatedDatasetDate,
        citationCode: m.relatedDatasetCode,
        note: relatedBits.length ? relatedBits.join(' | ') : null,
        associationType: 'crossReference',
        nilAggregateDataSetIdentifier: true,
        relatedOnlineResource: {
          url: relUrl,
          protocol: m.relatedDataUrlProtocol,
          name: m.relatedDataUrlTitle,
          description: m.relatedDataUrlDescription,
          applicationProfile: m.relatedDataUrlApplicationProfile
        }
      });
    } else {
      if (m.relatedDataUrlTitle) relatedBits.push(`Link title: ${m.relatedDataUrlTitle}`);
      if (m.relatedDataUrlDescription) relatedBits.push(m.relatedDataUrlDescription);
      addAggregateBlock({
        title: m.relatedDatasetTitle,
        dateVal: m.relatedDatasetDate,
        citationCode: m.relatedDatasetCode,
        note: relatedBits.length ? relatedBits.join(' | ') : null,
        associationType: 'crossReference',
        nilAggregateDataSetIdentifier: true
      });
    }

    addAggregateBlock({
      title: m.associatedPublicationTitle,
      dateVal: m.associatedPublicationDate,
      separatePublicationId: m.associatedPublicationCode,
      associationType: 'crossReference',
      initiativeType: 'sciencePaper'
    });
  }

  getNormalizedKeywordObjects(data) {
    const mission = data.mission || {};
    const structuredKeywords = Array.isArray(mission.gcmdKeywords)
      ? mission.gcmdKeywords
          .filter((k) => k && (k.prefLabel || k.label))
          .map((k) => ({
            label: String(k.prefLabel || k.label || '').trim(),
            scheme: String(k.scheme || 'sciencekeywords').trim().toLowerCase(),
            keywordVersion: String(k.keywordVersion || '').trim(),
            keywordType: String(k.keywordType || k.mdKeywordTypeCode || '').trim().toLowerCase()
          }))
          .filter((k) => k.label)
      : [];

    if (structuredKeywords.length > 0) return structuredKeywords;

    return Array.isArray(mission.keywords)
      ? mission.keywords
          .map((k) => String(k || '').trim())
          .filter(Boolean)
          .map((label) => ({ label, scheme: 'user', keywordVersion: '', keywordType: '' }))
      : [];
  }

  addDescriptiveKeywords(doc, dataIdentification, data) {
    const keywords = this.getNormalizedKeywordObjects(data);
    if (!keywords.length) return;

    const byScheme = {};
    keywords.forEach((keyword) => {
      const schemeKey = keyword.scheme || 'user';
      if (!byScheme[schemeKey]) byScheme[schemeKey] = [];
      byScheme[schemeKey].push(keyword);
    });

    Object.keys(byScheme).forEach((schemeKey) => {
      const schemeKeywords = byScheme[schemeKey];
      if (!schemeKeywords.length) return;

      const descriptiveKeywords = this.createElement(doc, 'gmd', 'descriptiveKeywords');
      const mdKeywords = this.createElement(doc, 'gmd', 'MD_Keywords');

      schemeKeywords.forEach((keyword) => {
        const kw = this.createElement(doc, 'gmd', 'keyword');
        kw.addContent(this.createCharacterString(doc, keyword.label));
        mdKeywords.addContent(kw);
      });

      const type = this.createElement(doc, 'gmd', 'type');
      const typeVal =
        (schemeKeywords[0] && schemeKeywords[0].keywordType) ||
        (schemeKey !== 'user' ? gcmdSchemeToKeywordTypeCode_(schemeKey) : 'theme');
      type.addContent(
        this.createNoaaCodelistElement(doc, 'gmd', 'MD_KeywordTypeCode', typeVal, typeVal)
      );
      mdKeywords.addContent(type);

      if (schemeKey !== 'user') {
        const thesaurusName = this.createElement(doc, 'gmd', 'thesaurusName');
        const citation = this.createElement(doc, 'gmd', 'CI_Citation');
        const title = this.createElement(doc, 'gmd', 'title');
        title.addContent(this.createCharacterString(doc, `GCMD ${schemeKey}`));
        citation.addContent(title);

        const version = schemeKeywords.find((k) => k.keywordVersion)?.keywordVersion || '';
        if (version) {
          const edition = this.createElement(doc, 'gmd', 'edition');
          edition.addContent(this.createCharacterString(doc, version));
          citation.addContent(edition);
        }

        const onlineResource = this.createElement(doc, 'gmd', 'onlineResource');
        const ciOnlineResource = this.createElement(doc, 'gmd', 'CI_OnlineResource');
        const linkage = this.createElement(doc, 'gmd', 'linkage');
        const url = this.createElement(
          doc,
          'gmd',
          'URL',
          'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all?gtm_scheme=all'
        );
        linkage.addContent(url);
        ciOnlineResource.addContent(linkage);
        onlineResource.addContent(ciOnlineResource);
        citation.addContent(onlineResource);

        thesaurusName.addContent(citation);
        mdKeywords.addContent(thesaurusName);
      }

      descriptiveKeywords.addContent(mdKeywords);
      dataIdentification.addContent(descriptiveKeywords);
    });
  }

  addSpatialRepresentationInfo(doc, root, data) {
    const grid = data.spatial?.gridRepresentation;
    if (grid && Array.isArray(grid.axes) && grid.axes.length > 0) {
      const spatialRepInfo = this.createElement(doc, 'gmd', 'spatialRepresentationInfo');
      const gridRep = this.createElement(doc, 'gmd', 'MD_GridSpatialRepresentation');
      const numberOfDimensions = this.createElement(doc, 'gmd', 'numberOfDimensions');
      numberOfDimensions.addContent(this.createInteger(doc, grid.axes.length));
      gridRep.addContent(numberOfDimensions);
      grid.axes.forEach((axis) => {
        const axisProp = this.createElement(doc, 'gmd', 'axisDimensionProperties');
        const mdDim = this.createElement(doc, 'gmd', 'MD_Dimension');
        const dimName = this.createElement(doc, 'gmd', 'dimensionName');
        const dimNameVal = String(axis.name || 'row').trim() || 'row';
        dimName.addContent(this.createNoaaCodelistElement(doc, 'gmd', 'MD_DimensionNameTypeCode', dimNameVal, dimNameVal));
        mdDim.addContent(dimName);
        const dimSize = this.createElement(doc, 'gmd', 'dimensionSize');
        const n = parseInt(String(axis.size != null ? axis.size : '0'), 10);
        dimSize.addContent(this.createInteger(doc, isNaN(n) ? 0 : n));
        mdDim.addContent(dimSize);
        if (axis.resolution && String(axis.resolution).trim()) {
          const resolution = this.createElement(doc, 'gmd', 'resolution');
          const measure = this.createMeasureFromResolution(doc, axis.resolution);
          if (measure) resolution.addContent(measure);
          else resolution.addContent(this.createCharacterString(doc, String(axis.resolution).trim()));
          mdDim.addContent(resolution);
        }
        axisProp.addContent(mdDim);
        gridRep.addContent(axisProp);
      });
      const cellVal = (grid.cellGeometry && String(grid.cellGeometry).trim()) || 'area';
      const cellGeometry = this.createElement(doc, 'gmd', 'cellGeometry');
      cellGeometry.addContent(this.createNoaaCodelistElement(doc, 'gmd', 'MD_CellGeometryCode', cellVal, cellVal));
      gridRep.addContent(cellGeometry);
      const tpa = this.createElement(doc, 'gmd', 'transformationParameterAvailability');
      tpa.addContent(this.createElement(doc, 'gco', 'Boolean', '0'));
      gridRep.addContent(tpa);
      spatialRepInfo.addContent(gridRep);
      root.addContent(spatialRepInfo);
      return;
    }

    if (!data.spatial?.dimensions) return;

    const spatialRepInfo = this.createElement(doc, 'gmd', 'spatialRepresentationInfo');
    const georectified = this.createElement(doc, 'gmd', 'MD_Georectified');

    const numberOfDimensions = this.createElement(doc, 'gmd', 'numberOfDimensions');
    numberOfDimensions.addContent(this.createInteger(doc, data.spatial.dimensions));
    georectified.addContent(numberOfDimensions);

    if (data.spatial.boundingBox) {
      ['upperLeft', 'upperRight', 'lowerRight', 'lowerLeft'].forEach((corner) => {
        if (data.spatial.boundingBox[corner]?.lon && data.spatial.boundingBox[corner]?.lat) {
          const cornerPoints = this.createElement(doc, 'gmd', 'cornerPoints');
          const point = this.createElement(doc, 'gml', 'Point');
          point.setAttribute('id', `cornerPoint-${corner}`);
          const pos = this.createElement(
            doc,
            'gml',
            'pos',
            `${data.spatial.boundingBox[corner].lon} ${data.spatial.boundingBox[corner].lat}`
          );
          point.addContent(pos);
          cornerPoints.addContent(point);
          georectified.addContent(cornerPoints);
        }
      });
    }

    spatialRepInfo.addContent(georectified);
    root.addContent(spatialRepInfo);
  }

  addAcquisitionInfo(doc, root, data) {
    if (!data.platform && (!data.sensors || data.sensors.length === 0)) return;

    const acquisitionInfo = this.createElement(doc, 'gmi', 'acquisitionInformation');
    const miAcquisitionInfo = this.createElement(doc, 'gmi', 'MI_AcquisitionInformation');

    if (data.platform) {
      const platform = this.createElement(doc, 'gmi', 'platform');
      const miPlatform = this.createElement(doc, 'gmi', 'MI_Platform');
      miPlatform.setAttribute('id', 'platform');

      if (data.platform.id) {
        const identifier = this.createElement(doc, 'gmd', 'identifier');
        const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
        const code = this.createElement(doc, 'gmd', 'code');
        code.addContent(this.createCharacterString(doc, data.platform.id));
        mdIdentifier.addContent(code);
        identifier.addContent(mdIdentifier);
        miPlatform.addContent(identifier);
      }

      const platformDesc =
        (data.platform.description && String(data.platform.description).trim()) ||
        (data.platform.name && String(data.platform.name).trim()) ||
        '';
      if (platformDesc) {
        const description = this.createElement(doc, 'gmd', 'description');
        description.addContent(this.createCharacterString(doc, platformDesc));
        miPlatform.addContent(description);
      }

      if (data.platform.type) {
        const type = this.createElement(doc, 'gmi', 'type');
        type.addContent(this.createCharacterString(doc, data.platform.type));
        miPlatform.addContent(type);
      }

      if (data.platform.manufacturer) {
        const sponsor = this.createElement(doc, 'gmd', 'pointOfContact');
        const responsibleParty = this.createElement(doc, 'gmd', 'CI_ResponsibleParty');
        const orgName = this.createElement(doc, 'gmd', 'organisationName');
        orgName.addContent(this.createCharacterString(doc, data.platform.manufacturer));
        responsibleParty.addContent(orgName);
        const role = this.createElement(doc, 'gmd', 'role');
        const roleCode = this.createElement(doc, 'gmd', 'CI_RoleCode', 'pointOfContact');
        role.addContent(roleCode);
        responsibleParty.addContent(role);
        sponsor.addContent(responsibleParty);
        miPlatform.addContent(sponsor);
      }

      if (data.platform.weight || data.platform.length || data.platform.width || data.platform.height || data.platform.material || data.platform.speed || data.platform.operationalArea) {
        const otherProperty = this.createElement(doc, 'gmi', 'otherProperty');
        const record = this.createElement(doc, 'gco', 'Record');
        const characteristics = this.createElement(doc, 'gmi', 'otherProperty');
        const characteristicList = this.createElement(doc, 'gmi', 'CharacteristicList');
        const characteristic = this.createElement(doc, 'gmi', 'characteristic');
        const dataRecord = this.createElement(doc, 'gmi', 'DataRecord');

        if (data.platform.weight) {
          const field = this.createElement(doc, 'gmi', 'field');
          field.setAttribute('name', 'Weight');
          const quantity = this.createElement(doc, 'gmi', 'Quantity');
          const value = this.createDecimal(doc, data.platform.weight);
          quantity.addContent(value);
          const uom = this.createElement(doc, 'gco', 'uom', 'kg');
          quantity.addContent(uom);
          field.addContent(quantity);
          dataRecord.addContent(field);
        }

        if (data.platform.length) {
          const field = this.createElement(doc, 'gmi', 'field');
          field.setAttribute('name', 'Length');
          const quantity = this.createElement(doc, 'gmi', 'Quantity');
          const value = this.createDecimal(doc, data.platform.length);
          quantity.addContent(value);
          const uom = this.createElement(doc, 'gco', 'uom', 'm');
          quantity.addContent(uom);
          field.addContent(quantity);
          dataRecord.addContent(field);
        }

        if (data.platform.width) {
          const field = this.createElement(doc, 'gmi', 'field');
          field.setAttribute('name', 'Width');
          const quantity = this.createElement(doc, 'gmi', 'Quantity');
          const value = this.createDecimal(doc, data.platform.width);
          quantity.addContent(value);
          const uom = this.createElement(doc, 'gco', 'uom', 'm');
          quantity.addContent(uom);
          field.addContent(quantity);
          dataRecord.addContent(field);
        }

        if (data.platform.height) {
          const field = this.createElement(doc, 'gmi', 'field');
          field.setAttribute('name', 'Height');
          const quantity = this.createElement(doc, 'gmi', 'Quantity');
          const value = this.createDecimal(doc, data.platform.height);
          quantity.addContent(value);
          const uom = this.createElement(doc, 'gco', 'uom', 'm');
          quantity.addContent(uom);
          field.addContent(quantity);
          dataRecord.addContent(field);
        }

        if (data.platform.material) {
          const field = this.createElement(doc, 'gmi', 'field');
          field.setAttribute('name', 'CasingMaterial');
          const category = this.createElement(doc, 'gmi', 'Category');
          const value = this.createCharacterString(doc, data.platform.material);
          category.addContent(value);
          field.addContent(category);
          dataRecord.addContent(field);
        }

        if (data.platform.speed) {
          const field = this.createElement(doc, 'gmi', 'field');
          field.setAttribute('name', 'SpeedOverWater');
          const quantity = this.createElement(doc, 'gmi', 'Quantity');
          const value = this.createDecimal(doc, data.platform.speed);
          quantity.addContent(value);
          const uom = this.createElement(doc, 'gco', 'uom', 'm/s');
          quantity.addContent(uom);
          field.addContent(quantity);
          dataRecord.addContent(field);
        }

        if (data.platform.operationalArea) {
          const field = this.createElement(doc, 'gmi', 'field');
          field.setAttribute('name', 'OperationalArea');
          const text = this.createCharacterString(doc, data.platform.operationalArea);
          field.addContent(text);
          dataRecord.addContent(field);
        }

        characteristic.addContent(dataRecord);
        characteristicList.addContent(characteristic);
        characteristics.addContent(characteristicList);
        record.addContent(characteristics);
        otherProperty.addContent(record);
        miPlatform.addContent(otherProperty);
      }

      platform.addContent(miPlatform);
      miAcquisitionInfo.addContent(platform);
    }

    if (data.sensors && data.sensors.length > 0) {
      data.sensors.forEach(sensor => {
        const instrument = this.createElement(doc, 'gmi', 'instrument');
        const miInstrument = this.createElement(doc, 'gmi', 'MI_Instrument');

        if (sensor.id) {
          const identifier = this.createElement(doc, 'gmd', 'identifier');
          const mdIdentifier = this.createElement(doc, 'gmd', 'MD_Identifier');
          const code = this.createElement(doc, 'gmd', 'code');
          code.addContent(this.createCharacterString(doc, sensor.id));
          mdIdentifier.addContent(code);
          identifier.addContent(mdIdentifier);
          miInstrument.addContent(identifier);
        }

        if (sensor.type) {
          const type = this.createElement(doc, 'gmi', 'type');
          type.addContent(this.createCharacterString(doc, sensor.type));
          miInstrument.addContent(type);
        }

        const descriptionItems = [];
        if (sensor.firmware) descriptionItems.push(`Firmware Version: ${sensor.firmware}`);
        if (sensor.operationMode) descriptionItems.push(`Operation Mode: ${sensor.operationMode}`);
        if (sensor.uncertainty) descriptionItems.push(`Uncertainty Estimate: ${sensor.uncertainty}`);
        if (sensor.frequency) descriptionItems.push(`Frequency: ${sensor.frequency}`);
        if (sensor.beamCount) descriptionItems.push(`Beam Count: ${sensor.beamCount}`);
        if (sensor.depthRating) descriptionItems.push(`Depth Rating: ${sensor.depthRating}`);
        if (sensor.confidenceInterval) descriptionItems.push(`Confidence Interval: ${sensor.confidenceInterval}`);
        if (descriptionItems.length > 0) {
          const description = this.createElement(doc, 'gmd', 'description');
          description.addContent(this.createCharacterString(doc, descriptionItems.join('\n')));
          miInstrument.addContent(description);
        }

        if (sensor.installDate || sensor.event || sensor.sensorLanguage || sensor.sensorCharacterSet) {
          const history = this.createElement(doc, 'gmi', 'history');
          const eventList = this.createElement(doc, 'gmi', 'MI_InstrumentationEventList');

          if (sensor.installDate) {
            const citation = this.createElement(doc, 'gmd', 'citation');
            const ciCitation = this.createElement(doc, 'gmd', 'CI_Citation');
            const date = this.createElement(doc, 'gmd', 'date');
            const ciDate = this.createElement(doc, 'gmd', 'CI_Date');
            const dateElement = this.createElement(doc, 'gmd', 'date');
            const dateTime = this.createDateTime(doc, sensor.installDate);
            if (dateTime) {
              dateElement.addContent(dateTime);
              ciDate.addContent(dateElement);
              const dateType = this.createElement(doc, 'gmd', 'dateType');
              const dateTypeCode = this.createElement(doc, 'gmd', 'CI_DateTypeCode', 'installation');
              dateType.addContent(dateTypeCode);
              ciDate.addContent(dateType);
              date.addContent(ciDate);
              ciCitation.addContent(date);
              citation.addContent(ciCitation);
              eventList.addContent(citation);
            }
          }

          if (sensor.event) {
            const description = this.createElement(doc, 'gmd', 'description');
            description.addContent(this.createCharacterString(doc, sensor.event));
            eventList.addContent(description);
          }

          if (sensor.sensorLanguage || sensor.sensorCharacterSet) {
            const locale = this.createElement(doc, 'gmd', 'locale');
            const ptLocale = this.createElement(doc, 'gmd', 'PT_Locale');
            if (sensor.sensorLanguage) {
              const language = this.createElement(doc, 'gmd', 'language');
              const languageCode = this.createElement(doc, 'gmd', 'LanguageCode', sensor.sensorLanguage);
              language.addContent(languageCode);
              ptLocale.addContent(language);
            }
            if (sensor.sensorCharacterSet) {
              const characterEncoding = this.createElement(doc, 'gmd', 'characterEncoding');
              const charSetCode = this.createElement(doc, 'gmd', 'MD_CharacterSetCode', sensor.sensorCharacterSet);
              characterEncoding.addContent(charSetCode);
              ptLocale.addContent(characterEncoding);
            }
            locale.addContent(ptLocale);
            eventList.addContent(locale);
          }

          history.addContent(eventList);
          miInstrument.addContent(history);
        }

        if (data.platform) {
          miInstrument.setAttribute('href', '#platform', this.xlinkNamespace_());
        }

        instrument.addContent(miInstrument);
        miAcquisitionInfo.addContent(instrument);
      });
    }

    acquisitionInfo.addContent(miAcquisitionInfo);
    root.addContent(acquisitionInfo);
  }

  addDataQualityInfo(doc, root, data) {
    if (!data.spatial?.accuracyStandard && !data.spatial?.errorLevel) return;

    const dataQualityInfo = this.createElement(doc, 'gmd', 'dataQualityInfo');
    const dqDataQuality = this.createElement(doc, 'gmd', 'DQ_DataQuality');

    const scope = this.createElement(doc, 'gmd', 'scope');
    const dqScope = this.createElement(doc, 'gmd', 'DQ_Scope');
    const level = this.createElement(doc, 'gmd', 'level');
    const scopeCode = this.createElement(doc, 'gmd', 'MD_ScopeCode', 'dataset');
    level.addContent(scopeCode);
    dqScope.addContent(level);
    scope.addContent(dqScope);
    dqDataQuality.addContent(scope);

    if (data.spatial.accuracyStandard) {
      const report = this.createElement(doc, 'gmd', 'report');
      const dqQuantitative = this.createElement(doc, 'gmd', 'DQ_QuantitativeAttributeAccuracy');
      const result = this.createElement(doc, 'gmd', 'result');
      const dqResult = this.createElement(doc, 'gmd', 'DQ_QuantitativeResult');
      const valueType = this.createElement(doc, 'gco', 'RecordType', data.spatial.accuracyStandard);
      dqResult.addContent(valueType);
      const value = this.createElement(doc, 'gco', 'Record');
      const quantity = this.createElement(doc, 'gmi', 'Quantity');
      const qValue = this.createDecimal(doc, data.spatial.accuracyValue || 0);
      quantity.addContent(qValue);
      const uom = this.createElement(doc, 'gco', 'uom', 'm');
      quantity.addContent(uom);
      value.addContent(quantity);
      dqResult.addContent(value);
      result.addContent(dqResult);
      dqQuantitative.addContent(result);
      report.addContent(dqQuantitative);
      dqDataQuality.addContent(report);
    }

    if (data.spatial.errorLevel) {
      const report = this.createElement(doc, 'gmd', 'report');
      const dqPositional = this.createElement(doc, 'gmd', 'DQ_AbsoluteExternalPositionalAccuracy');
      const result = this.createElement(doc, 'gmd', 'result');
      const dqResult = this.createElement(doc, 'gmd', 'DQ_QuantitativeResult');
      const valueType = this.createElement(doc, 'gco', 'RecordType', data.spatial.errorLevel);
      dqResult.addContent(valueType);
      const value = this.createElement(doc, 'gco', 'Record');
      const quantity = this.createElement(doc, 'gmi', 'Quantity');
      const qValue = this.createDecimal(doc, data.spatial.errorValue || 0);
      quantity.addContent(qValue);
      const uom = this.createElement(doc, 'gco', 'uom', 'm');
      quantity.addContent(uom);
      value.addContent(quantity);
      dqResult.addContent(value);
      result.addContent(dqResult);
      dqPositional.addContent(result);
      report.addContent(dqPositional);
      dqDataQuality.addContent(report);
    }

    dataQualityInfo.addContent(dqDataQuality);
    root.addContent(dataQualityInfo);
  }

  addDistributionOnlineLine(doc, digitalTransferOptions, url, protocol, name, description, functionCode) {
    if (!url || !String(url).trim()) return;
    const onLine = this.createElement(doc, 'gmd', 'onLine');
    const ciOnlineResource = this.createElement(doc, 'gmd', 'CI_OnlineResource');
    const linkage = this.createElement(doc, 'gmd', 'linkage');
    linkage.addContent(this.createElement(doc, 'gmd', 'URL', String(url).trim()));
    ciOnlineResource.addContent(linkage);
    if (protocol && String(protocol).trim()) {
      const p = this.createElement(doc, 'gmd', 'protocol');
      p.addContent(this.createCharacterString(doc, String(protocol).trim()));
      ciOnlineResource.addContent(p);
    }
    if (name && String(name).trim()) {
      const n = this.createElement(doc, 'gmd', 'name');
      n.addContent(this.createCharacterString(doc, String(name).trim()));
      ciOnlineResource.addContent(n);
    }
    if (description && String(description).trim()) {
      const d = this.createElement(doc, 'gmd', 'description');
      d.addContent(this.createCharacterString(doc, String(description).trim()));
      ciOnlineResource.addContent(d);
    }
    if (functionCode && String(functionCode).trim()) {
      const fn = this.createElement(doc, 'gmd', 'function');
      fn.addContent(
        this.createNoaaCodelistElement(doc, 'gmd', 'CI_OnLineFunctionCode', String(functionCode).trim(), String(functionCode).trim())
      );
      ciOnlineResource.addContent(fn);
    }
    onLine.addContent(ciOnlineResource);
    digitalTransferOptions.addContent(onLine);
  }

  addMetadataMaintenanceRoot(doc, root, data) {
    const freq = (data.output && data.output.metadataMaintenanceFrequency) || 'asNeeded';
    const mm = this.createElement(doc, 'gmd', 'metadataMaintenance');
    const mi = this.createElement(doc, 'gmd', 'MD_MaintenanceInformation');
    const mauf = this.createElement(doc, 'gmd', 'maintenanceAndUpdateFrequency');
    mauf.addContent(this.createNoaaCodelistElement(doc, 'gmd', 'MD_MaintenanceFrequencyCode', freq, freq));
    mi.addContent(mauf);
    mm.addContent(mi);
    root.addContent(mm);
  }

  addDistributionInfo(doc, root, data) {
    const out = data.output || {};
    const m = data.mission || {};
    const distributionInfo = this.createElement(doc, 'gmd', 'distributionInfo');
    const distribution = this.createElement(doc, 'gmd', 'MD_Distribution');
    const distributorWrap = this.createElement(doc, 'gmd', 'distributor');
    const mdDist = this.createElement(doc, 'gmd', 'MD_Distributor');

    const distContact = this.createElement(doc, 'gmd', 'distributorContact');
    const xlinkNs = this.xlinkNamespace_();
    const href = String(out.nceiDistributorContactHref || this.schema.nceiMetadataContactHref || '').trim();
    if (href) distContact.setAttribute('href', href, xlinkNs);
    distContact.setAttribute('title', String(out.nceiDistributorContactTitle || 'NCEI (distributor)'), xlinkNs);
    mdDist.addContent(distContact);

    const orderProcess = this.createElement(doc, 'gmd', 'distributionOrderProcess');
    const sop = this.createElement(doc, 'gmd', 'MD_StandardOrderProcess');
    const fees = this.createElement(doc, 'gmd', 'fees');
    fees.addContent(
      this.createCharacterString(
        doc,
        out.distributionFeesText ||
          'In most cases, electronic downloads of the data are free. However, fees may apply for custom orders, data certifications, copies of analog materials, and data distribution on physical media.'
      )
    );
    sop.addContent(fees);
    const ord = this.createElement(doc, 'gmd', 'orderingInstructions');
    ord.addContent(
      this.createCharacterString(
        doc,
        out.distributionOrderingInstructions || 'Contact NCEI for other distribution options and instructions.'
      )
    );
    sop.addContent(ord);
    orderProcess.addContent(sop);
    mdDist.addContent(orderProcess);

    const distFormat = this.createElement(doc, 'gmd', 'distributorFormat');
    const mdFormat = this.createElement(doc, 'gmd', 'MD_Format');
    const nameEl = this.createElement(doc, 'gmd', 'name');
    const fileFormat =
      out.distributionFormatName ||
      out.distributionFileFormat ||
      out.dataDistributionFormat ||
      (out.outputFormat === 'xml' ? 'ISO 19115-2 XML metadata' : out.outputFormat) ||
      'NetCDF';
    nameEl.addContent(this.createCharacterString(doc, fileFormat));
    mdFormat.addContent(nameEl);
    const ver = this.createElement(doc, 'gmd', 'version');
    ver.setAttribute('nilReason', 'inapplicable', this.gcoAttrNamespace_());
    mdFormat.addContent(ver);
    distFormat.addContent(mdFormat);
    mdDist.addContent(distFormat);

    const prefixedId = this.nceiPrefixedFileIdentifier_(m.id, data) || String(m.id || '').trim();
    const landing = out.metadataLandingUrl || out.metadataLandingPage;
    const defaultLanding =
      prefixedId &&
      `https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/${encodeURIComponent(prefixedId)}/html/`;

    const dtoLanding = this.createElement(doc, 'gmd', 'distributorTransferOptions');
    const digitalLanding = this.createElement(doc, 'gmd', 'MD_DigitalTransferOptions');
    this.addDistributionOnlineLine(
      doc,
      digitalLanding,
      landing || defaultLanding || 'https://www.ncei.noaa.gov/',
      'HTTPS',
      'Metadata Landing Page',
      out.metadataLandingDescription || null,
      'information'
    );
    dtoLanding.addContent(digitalLanding);
    mdDist.addContent(dtoLanding);

    const downUrl = out.downloadUrl || out.accessURL;
    if (downUrl && String(downUrl).trim()) {
      const dtoDown = this.createElement(doc, 'gmd', 'distributorTransferOptions');
      const digitalDown = this.createElement(doc, 'gmd', 'MD_DigitalTransferOptions');
      this.addDistributionOnlineLine(
        doc,
        digitalDown,
        downUrl,
        out.downloadProtocol || out.accessProtocol,
        out.downloadLinkName || out.downloadName,
        out.downloadLinkDescription || out.downloadDescription,
        'download'
      );
      dtoDown.addContent(digitalDown);
      mdDist.addContent(dtoDown);
    }

    distributorWrap.addContent(mdDist);
    distribution.addContent(distributorWrap);
    distributionInfo.addContent(distribution);
    root.addContent(distributionInfo);
  }

  buildCoverageDescriptor_(data, sensor) {
    const plat =
      (data.platform && (data.platform.name || data.platform.description || data.platform.id)) || '';
    const st = (sensor && (sensor.type || sensor.description)) || '';
    if (plat && st) return `${plat} — ${st}`;
    return plat || st || 'Platform and instrument';
  }

  addContentInfo(doc, root, data) {
    const contentInfo = this.createElement(doc, 'gmd', 'contentInfo');
    const cov = this.createElement(doc, 'gmi', 'MI_CoverageDescription');

    const attrDesc = this.createElement(doc, 'gmd', 'attributeDescription');
    attrDesc.setAttribute('nilReason', 'unknown', this.gcoAttrNamespace_());
    cov.addContent(attrDesc);

    const contentType = this.createElement(doc, 'gmd', 'contentType');
    contentType.addContent(
      this.createNoaaCodelistElement(
        doc,
        'gmd',
        'MD_CoverageContentTypeCode',
        'physicalMeasurement',
        'physicalMeasurement'
      )
    );
    cov.addContent(contentType);

    const sensorList =
      data.sensors && data.sensors.length > 0
        ? data.sensors
        : [{ type: 'Sensor observation', variableName: null, dataType: 'String' }];

    sensorList.forEach((sensor) => {
      const dimension = this.createElement(doc, 'gmd', 'dimension');
      const mdBand = this.createElement(doc, 'gmd', 'MD_Band');
      const sequenceIdentifier = this.createElement(doc, 'gmd', 'sequenceIdentifier');
      const memberName = this.createElement(doc, 'gco', 'MemberName');
      const aName = this.createElement(doc, 'gco', 'aName');
      aName.addContent(
        this.createCharacterString(
          doc,
          sensor.variableName || sensor.name || sensor.id || sensor.type || 'observation'
        )
      );
      memberName.addContent(aName);
      const attributeType = this.createElement(doc, 'gco', 'attributeType');
      const typeName = this.createElement(doc, 'gco', 'TypeName');
      const aName2 = this.createElement(doc, 'gco', 'aName');
      aName2.addContent(this.createCharacterString(doc, sensor.dataType || sensor.attributeType || 'String'));
      typeName.addContent(aName2);
      attributeType.addContent(typeName);
      memberName.addContent(attributeType);
      sequenceIdentifier.addContent(memberName);
      mdBand.addContent(sequenceIdentifier);

      const descriptor = this.createElement(doc, 'gmd', 'descriptor');
      descriptor.addContent(
        this.createCharacterString(doc, sensor.coverageDescriptor || this.buildCoverageDescriptor_(data, sensor))
      );
      mdBand.addContent(descriptor);
      dimension.addContent(mdBand);
      cov.addContent(dimension);
    });

    contentInfo.addContent(cov);
    root.addContent(contentInfo);
  }
}

function emptyUniversalParsedMetadata_() {
  return {
    mission: {},
    platform: {},
    sensors: [],
    spatial: { boundingBox: {} },
    output: { outputFormat: 'xml', validationLevel: 'basic', saveAsTemplate: false }
  };
}

class UniversalXMLParser {
  constructor() {
    this.defaultSchema = 'iso19115-2';
  }

  detectSchema(root, xmlString) {
    const namespace = root.getNamespace();
    const namespaceUri = namespace ? namespace.getURI() : '';
    const rootName = root.getName();

    if (namespaceUri === ISO_SCHEMAS['iso19115-2'].namespaces.gmi) {
      return 'iso19115-2';
    }

    if (rootName === 'MI_Metadata') {
      return 'iso19115-2';
    }

    if (rootName === 'MD_Metadata') {
      if (/xmlns:gmi="http:\/\/www\.isotc211\.org\/2005\/gmi"/.test(xmlString) || /xmlns:gmd="http:\/\/www\.isotc211\.org\/2005\/gmd"/.test(xmlString)) {
        return 'iso19115-2';
      }
    }

    if (/<gmi:MI_Metadata\b/.test(xmlString)) {
      return 'iso19115-2';
    }

    throw new Error(`Unable to detect XML schema from root \"${rootName}\" and namespace \"${namespaceUri || 'none'}\"`);
  }

  parse(xmlString) {
    try {
      Logger.log(`INFO: UniversalXMLParser - Parsing XML with auto-detection`);
      if (xmlString == null || String(xmlString).trim() === '') {
        Logger.log('WARN: UniversalXMLParser - Empty XML input; returning empty metadata shell');
        return {
          data: emptyUniversalParsedMetadata_(),
          detectedSchema: null,
          emptyInput: true
        };
      }
      const doc = XmlService.parse(xmlString);
      const root = doc.getRootElement();
      const detectedSchema = this.detectSchema(root, xmlString);

      const data = this.parseToData(doc, detectedSchema);
      Logger.log(`INFO: UniversalXMLParser - XML parsed successfully, detected schema: ${detectedSchema}`);
      return { data, detectedSchema, emptyInput: false };
    } catch (error) {
      Logger.log(`ERROR: UniversalXMLParser - Parsing failed: ${error.message}`);
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  parseToData(doc, schema) {
    const data = {
      mission: {},
      platform: {},
      sensors: [],
      spatial: { boundingBox: {} },
      output: { outputFormat: 'xml', validationLevel: 'basic', saveAsTemplate: false }
    };

    const root = doc.getRootElement();
    this.parseISO19115_2(root, data);

    return data;
  }

  parseISO19115_2(root, data) {
    const getText = (element) => (element ? element.getText() : '');
    const ns = ISO_SCHEMAS['iso19115-2'].namespaces;

    const parseNonRorOnlineResourceDetails = (ciOnlineResource, mission) => {
      if (!ciOnlineResource) return;
      const linkage = ciOnlineResource.getChild('linkage', XmlService.getNamespace(ns.gmd));
      const urlEl = linkage ? linkage.getChild('URL', XmlService.getNamespace(ns.gmd)) : null;
      const url = getText(urlEl);
      if (!url || /ror\.org\//i.test(url)) return;
      if (!mission.contactUrl) mission.contactUrl = url;
      const protoEl = ciOnlineResource.getChild('protocol', XmlService.getNamespace(ns.gmd));
      const protoCs = protoEl ? protoEl.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
      const proto = getText(protoCs);
      if (proto && !mission.contactUrlProtocol) mission.contactUrlProtocol = proto;
      const nameEl = ciOnlineResource.getChild('name', XmlService.getNamespace(ns.gmd));
      const nameCs = nameEl ? nameEl.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
      const nm = getText(nameCs);
      if (nm && !mission.contactUrlResourceName) mission.contactUrlResourceName = nm;
      const descEl = ciOnlineResource.getChild('description', XmlService.getNamespace(ns.gmd));
      const descCs = descEl ? descEl.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
      const dsc = getText(descCs);
      if (dsc && !mission.contactUrlResourceDescription) mission.contactUrlResourceDescription = dsc;
      const apEl = ciOnlineResource.getChild('applicationProfile', XmlService.getNamespace(ns.gmd));
      const apCs = apEl ? apEl.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
      const ap = getText(apCs);
      if (ap && !mission.contactApplicationProfile) mission.contactApplicationProfile = ap;
    };

    // Metadata Identifier
    const fileId = root.getChild('fileIdentifier', XmlService.getNamespace(ns.gmd));
    if (fileId) {
      const charString = fileId.getChild('CharacterString', XmlService.getNamespace(ns.gco));
      data.mission.id = getText(charString);
    }

    // Language and Character Set
    const language = root.getChild('language', XmlService.getNamespace(ns.gmd));
    if (language) {
      const charString = language.getChild('CharacterString', XmlService.getNamespace(ns.gco));
      data.mission.language = getText(charString);
    }

    const charSet = root.getChild('characterSet', XmlService.getNamespace(ns.gmd));
    if (charSet) {
      const charSetCode = charSet.getChild('MD_CharacterSetCode', XmlService.getNamespace(ns.gmd));
      data.mission.characterSet = getText(charSetCode);
    }

    const hierarchyLevel = root.getChild('hierarchyLevel', XmlService.getNamespace(ns.gmd));
    if (hierarchyLevel) {
      const scopeCode = hierarchyLevel.getChild('MD_ScopeCode', XmlService.getNamespace(ns.gmd));
      data.mission.scopeCode = getText(scopeCode);
    }

    // Contact
    const contact = root.getChild('contact', XmlService.getNamespace(ns.gmd));
    if (contact) {
      const xlinkNs = XmlService.getNamespace('xlink', ns.xlink);
      const hrefAttr = contact.getAttribute('href', xlinkNs);
      if (hrefAttr && hrefAttr.getValue()) {
        data.output.useNceiMetadataContactXlink = true;
        data.output.nceiMetadataContactHref = hrefAttr.getValue();
        const titleAttr = contact.getAttribute('title', xlinkNs);
        if (titleAttr && titleAttr.getValue()) {
          data.output.nceiMetadataContactTitle = titleAttr.getValue();
        }
      }
      const responsibleParty = contact.getChild('CI_ResponsibleParty', XmlService.getNamespace(ns.gmd));
      if (responsibleParty) {
        const indName = responsibleParty.getChild('individualName', XmlService.getNamespace(ns.gmd));
        if (indName) {
          const charString = indName.getChild('CharacterString', XmlService.getNamespace(ns.gco));
          data.mission.contactIndividualName = getText(charString);
        }
        const orgName = responsibleParty.getChild('organisationName', XmlService.getNamespace(ns.gmd));
        if (orgName) {
          const charString = orgName.getChild('CharacterString', XmlService.getNamespace(ns.gco));
          data.mission.organization = getText(charString);
        }

        const contactInfo = responsibleParty.getChild('contactInfo', XmlService.getNamespace(ns.gmd));
        if (contactInfo) {
          const ciContact = contactInfo.getChild('CI_Contact', XmlService.getNamespace(ns.gmd));
          if (ciContact) {
            const phone = ciContact.getChild('phone', XmlService.getNamespace(ns.gmd));
            if (phone) {
              const ciTelephone = phone.getChild('CI_Telephone', XmlService.getNamespace(ns.gmd));
              if (ciTelephone) {
                const number = ciTelephone.getChild('voice', XmlService.getNamespace(ns.gmd));
                if (number) {
                  const charString = number.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                  data.mission.contactPhone = getText(charString);
                }
              }
            }

            const address = ciContact.getChild('address', XmlService.getNamespace(ns.gmd));
            if (address) {
              const ciAddress = address.getChild('CI_Address', XmlService.getNamespace(ns.gmd));
              if (ciAddress) {
                const deliveryPoint = ciAddress.getChild('deliveryPoint', XmlService.getNamespace(ns.gmd));
                if (deliveryPoint) {
                  const charString = deliveryPoint.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                  data.mission.contactAddress = getText(charString);
                }
                const email = ciAddress.getChild('electronicMailAddress', XmlService.getNamespace(ns.gmd));
                if (email) {
                  const charString = email.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                  data.mission.contactEmail = getText(charString);
                }
              }
            }

            const onlineResources = ciContact.getChildren('onlineResource', XmlService.getNamespace(ns.gmd));
            onlineResources.forEach((onlineResource) => {
              const ciOnlineResource = onlineResource.getChild('CI_OnlineResource', XmlService.getNamespace(ns.gmd));
              if (!ciOnlineResource) return;
              const linkage = ciOnlineResource.getChild('linkage', XmlService.getNamespace(ns.gmd));
              if (!linkage) return;
              const url = getText(linkage.getChild('URL', XmlService.getNamespace(ns.gmd)));
              if (!url) return;
              if (/ror\.org\//i.test(url)) {
                const match = url.match(/ror\.org\/([^/?#]+)/i);
                if (match) data.mission.organizationRorId = match[1];
                data.mission.organizationRorUri = url;
              } else {
                parseNonRorOnlineResourceDetails(ciOnlineResource, data.mission);
              }
            });
          }
        }
      }
    }

    // Date Info (metadata record stamp — distinct from acquisition dates in citation)
    const dateStamp = root.getChild('dateStamp', XmlService.getNamespace(ns.gmd));
    if (dateStamp) {
      const dateTime = dateStamp.getChild('DateTime', XmlService.getNamespace(ns.gco));
      const dateOnly = dateStamp.getChild('Date', XmlService.getNamespace(ns.gco));
      data.mission.metadataRecordDate = getText(dateTime) || getText(dateOnly);
    }

    // Metadata Standard
    const metadataStandardName = root.getChild('metadataStandardName', XmlService.getNamespace(ns.gmd));
    if (metadataStandardName) {
      const charString = metadataStandardName.getChild('CharacterString', XmlService.getNamespace(ns.gco));
      data.output.metadataStandard = getText(charString);
    }

    const metadataStandardVersion = root.getChild('metadataStandardVersion', XmlService.getNamespace(ns.gmd));
    if (metadataStandardVersion) {
      const charString = metadataStandardVersion.getChild('CharacterString', XmlService.getNamespace(ns.gco));
      data.output.metadataVersion = getText(charString);
    }

    // Reference System Info
    const referenceSystemInfo = root.getChild('referenceSystemInfo', XmlService.getNamespace(ns.gmd));
    if (referenceSystemInfo) {
      const referenceSystem = referenceSystemInfo.getChild('MD_ReferenceSystem', XmlService.getNamespace(ns.gmd));
      if (referenceSystem) {
        const referenceSystemIdentifier = referenceSystem.getChild('referenceSystemIdentifier', XmlService.getNamespace(ns.gmd));
        if (referenceSystemIdentifier) {
          const rsIdentifier = referenceSystemIdentifier.getChild('RS_Identifier', XmlService.getNamespace(ns.gmd));
          if (rsIdentifier) {
            const code = rsIdentifier.getChild('code', XmlService.getNamespace(ns.gmd));
            if (code) {
              const charString = code.getChild('CharacterString', XmlService.getNamespace(ns.gco));
              data.spatial.referenceSystem = getText(charString);
            }
          }
        }
      }
    }
    if (!referenceSystemInfo) {
      data.output.omitRootReferenceSystemInfo = true;
    }

    // Distribution
    const distributionInfoRoot = root.getChild('distributionInfo', XmlService.getNamespace(ns.gmd));
    if (distributionInfoRoot) {
      const distribution = distributionInfoRoot.getChild('MD_Distribution', XmlService.getNamespace(ns.gmd));
      if (distribution) {
        const parseOnLineResource = (ci) => {
          if (!ci) return;
          const linkage = ci.getChild('linkage', XmlService.getNamespace(ns.gmd));
          const urlEl = linkage ? linkage.getChild('URL', XmlService.getNamespace(ns.gmd)) : null;
          const url = getText(urlEl);
          if (!url) return;
          const nameEl = ci.getChild('name', XmlService.getNamespace(ns.gmd));
          const nameCs = nameEl ? nameEl.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
          const name = getText(nameCs);
          const protoEl = ci.getChild('protocol', XmlService.getNamespace(ns.gmd));
          const protoCs = protoEl ? protoEl.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
          const protocol = getText(protoCs);
          const fnEl = ci.getChild('function', XmlService.getNamespace(ns.gmd));
          const fnCode = fnEl ? fnEl.getChild('CI_OnLineFunctionCode', XmlService.getNamespace(ns.gmd)) : null;
          const fnVal = getText(fnCode);
          if (fnVal === 'download') {
            data.output.downloadUrl = url;
            if (protocol) data.output.downloadProtocol = protocol;
            if (name) data.output.downloadLinkName = name;
          } else if (
            fnVal === 'information' ||
            /landing/i.test(name) ||
            !data.output.metadataLandingUrl
          ) {
            data.output.metadataLandingUrl = url;
          } else {
            data.output.downloadUrl = url;
            if (protocol) data.output.downloadProtocol = protocol;
            if (name) data.output.downloadLinkName = name;
          }
        };

        const distributorEl = distribution.getChild('distributor', XmlService.getNamespace(ns.gmd));
        if (distributorEl) {
          const mdDistributor = distributorEl.getChild('MD_Distributor', XmlService.getNamespace(ns.gmd));
          if (mdDistributor) {
            const dContact = mdDistributor.getChild('distributorContact', XmlService.getNamespace(ns.gmd));
            if (dContact) {
              const xl = XmlService.getNamespace('xlink', ns.xlink);
              const h = dContact.getAttribute('href', xl);
              if (h && h.getValue()) {
                data.output.nceiDistributorContactHref = h.getValue();
                const t = dContact.getAttribute('title', xl);
                if (t && t.getValue()) data.output.nceiDistributorContactTitle = t.getValue();
              }
            }
            const distFmt = mdDistributor.getChild('distributorFormat', XmlService.getNamespace(ns.gmd));
            if (distFmt) {
              const mdFormat = distFmt.getChild('MD_Format', XmlService.getNamespace(ns.gmd));
              const nameEl = mdFormat ? mdFormat.getChild('name', XmlService.getNamespace(ns.gmd)) : null;
              const charString = nameEl ? nameEl.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
              if (charString) {
                data.output.distributionFileFormat = getText(charString);
              }
            }
            const dpts = mdDistributor.getChildren('distributorTransferOptions', XmlService.getNamespace(ns.gmd));
            dpts.forEach((dpt) => {
              const dto = dpt.getChild('MD_DigitalTransferOptions', XmlService.getNamespace(ns.gmd));
              if (!dto) return;
              dto.getChildren('onLine', XmlService.getNamespace(ns.gmd)).forEach((onLine) => {
                parseOnLineResource(onLine.getChild('CI_OnlineResource', XmlService.getNamespace(ns.gmd)));
              });
            });
          }
        } else {
          const df = distribution.getChild('distributionFormat', XmlService.getNamespace(ns.gmd));
          if (df) {
            const mdFormat = df.getChild('MD_Format', XmlService.getNamespace(ns.gmd));
            const fsc = mdFormat
              ? mdFormat.getChild('formatSpecificationCitation', XmlService.getNamespace(ns.gmd))
              : null;
            const cit = fsc ? fsc.getChild('CI_Citation', XmlService.getNamespace(ns.gmd)) : null;
            const title = cit ? cit.getChild('title', XmlService.getNamespace(ns.gmd)) : null;
            const charString = title ? title.getChild('CharacterString', XmlService.getNamespace(ns.gco)) : null;
            if (charString) {
              data.output.distributionFileFormat = getText(charString);
            }
          }
          const transferOptions = distribution.getChild('transferOptions', XmlService.getNamespace(ns.gmd));
          const dto = transferOptions
            ? transferOptions.getChild('MD_DigitalTransferOptions', XmlService.getNamespace(ns.gmd))
            : null;
          if (dto) {
            dto.getChildren('onLine', XmlService.getNamespace(ns.gmd)).forEach((onLine) => {
              parseOnLineResource(onLine.getChild('CI_OnlineResource', XmlService.getNamespace(ns.gmd)));
            });
          }
        }
      }
    }

    // Identification Info
    const identificationInfo = root.getChild('identificationInfo', XmlService.getNamespace(ns.gmd));
    if (identificationInfo) {
      const dataIdentification = identificationInfo.getChild('MD_DataIdentification', XmlService.getNamespace(ns.gmd));
      if (dataIdentification) {
        const citation = dataIdentification.getChild('citation', XmlService.getNamespace(ns.gmd));
        if (citation) {
          const ciCitation = citation.getChild('CI_Citation', XmlService.getNamespace(ns.gmd));
          if (ciCitation) {
            const title = ciCitation.getChild('title', XmlService.getNamespace(ns.gmd));
            if (title) {
              const charString = title.getChild('CharacterString', XmlService.getNamespace(ns.gco));
              data.mission.title = getText(charString);
            }
            const alternateTitle = ciCitation.getChild('alternateTitle', XmlService.getNamespace(ns.gmd));
            if (alternateTitle) {
              const charString = alternateTitle.getChild('CharacterString', XmlService.getNamespace(ns.gco));
              data.mission.alternateTitle = getText(charString);
            }
            const citedWrappers = ciCitation.getChildren('citedResponsibleParty', XmlService.getNamespace(ns.gmd));
            citedWrappers.forEach((crp) => {
              const party = crp.getChild('CI_ResponsibleParty', XmlService.getNamespace(ns.gmd));
              if (!party) return;
              const roleEl = party.getChild('role', XmlService.getNamespace(ns.gmd));
              const roleCode = roleEl ? roleEl.getChild('CI_RoleCode', XmlService.getNamespace(ns.gmd)) : null;
              const roleVal = getText(roleCode);
              if (roleVal === 'publisher') {
                const pn = party.getChild('organisationName', XmlService.getNamespace(ns.gmd));
                if (pn) {
                  const cs = pn.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                  data.mission.citationPublisherOrganization = getText(cs);
                }
                return;
              }
              if (roleVal !== 'author' && roleVal !== 'originator') return;
              const ind = party.getChild('individualName', XmlService.getNamespace(ns.gmd));
              if (ind) {
                const cs = ind.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                const t = getText(cs);
                if (t && !data.mission.contactIndividualName) data.mission.contactIndividualName = t;
              }
              const on = party.getChild('organisationName', XmlService.getNamespace(ns.gmd));
              if (on) {
                const cs = on.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                const t = getText(cs);
                if (t && !data.mission.organization) data.mission.organization = t;
              }
              const cInf = party.getChild('contactInfo', XmlService.getNamespace(ns.gmd));
              const ciC = cInf ? cInf.getChild('CI_Contact', XmlService.getNamespace(ns.gmd)) : null;
              if (ciC) {
                const addr = ciC.getChild('address', XmlService.getNamespace(ns.gmd));
                const ciAddr = addr ? addr.getChild('CI_Address', XmlService.getNamespace(ns.gmd)) : null;
                if (ciAddr) {
                  const em = ciAddr.getChild('electronicMailAddress', XmlService.getNamespace(ns.gmd));
                  if (em) {
                    const cs = em.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                    const t = getText(cs);
                    if (t && !data.mission.contactEmail) data.mission.contactEmail = t;
                  }
                }
                ciC.getChildren('onlineResource', XmlService.getNamespace(ns.gmd)).forEach((onRes) => {
                  const ciOr = onRes.getChild('CI_OnlineResource', XmlService.getNamespace(ns.gmd));
                  parseNonRorOnlineResourceDetails(ciOr, data.mission);
                });
              }
            });
            const dates = ciCitation.getChildren('date', XmlService.getNamespace(ns.gmd));
            dates.forEach(date => {
              const ciDate = date.getChild('CI_Date', XmlService.getNamespace(ns.gmd));
              if (ciDate) {
                const dateType = ciDate.getChild('dateType', XmlService.getNamespace(ns.gmd));
                if (dateType) {
                  const dateTypeCode = dateType.getChild('CI_DateTypeCode', XmlService.getNamespace(ns.gmd));
                  const dateElement = ciDate.getChild('date', XmlService.getNamespace(ns.gmd));
                  if (dateElement) {
                    const dateTime = dateElement.getChild('DateTime', XmlService.getNamespace(ns.gco));
                    const dateOnly = dateElement.getChild('Date', XmlService.getNamespace(ns.gco));
                    const stamp = getText(dateTime) || getText(dateOnly);
                    const typeVal = getText(dateTypeCode);
                    if (typeVal === 'creation') {
                      data.mission.startDate = stamp;
                    } else if (typeVal === 'completion') {
                      data.mission.endDate = stamp;
                    } else if (typeVal === 'publication') {
                      data.mission.publicationDate = stamp;
                    }
                  }
                }
              }
            });
            const identifiers = ciCitation.getChildren('identifier', XmlService.getNamespace(ns.gmd));
            identifiers.forEach((identifier) => {
              const mdIdentifier = identifier.getChild('MD_Identifier', XmlService.getNamespace(ns.gmd));
              if (!mdIdentifier) return;
              const code = mdIdentifier.getChild('code', XmlService.getNamespace(ns.gmd));
              if (!code) return;
              const anchor = code.getChild('Anchor', XmlService.getNamespace(ns.gmx));
              const charString = code.getChild('CharacterString', XmlService.getNamespace(ns.gco));
              const val = (anchor && getText(anchor)) || getText(charString);
              if (!val) return;
              if (/^10\.\d+/i.test(val)) {
                data.output.doi = val;
              } else if (!data.mission.nceiAccessionId && /^\d{8,}$/.test(val.replace(/\s/g, ''))) {
                data.mission.nceiAccessionId = val;
              }
            });
          }
        }

        const abstract = dataIdentification.getChild('abstract', XmlService.getNamespace(ns.gmd));
        if (abstract) {
          const charString = abstract.getChild('CharacterString', XmlService.getNamespace(ns.gco));
          data.mission.abstract = getText(charString);
        }

        const purpose = dataIdentification.getChild('purpose', XmlService.getNamespace(ns.gmd));
        if (purpose) {
          const charString = purpose.getChild('CharacterString', XmlService.getNamespace(ns.gco));
          data.mission.purpose = getText(charString);
        }

        const supplementalInformation = dataIdentification.getChild(
          'supplementalInformation',
          XmlService.getNamespace(ns.gmd)
        );
        if (supplementalInformation) {
          const charString = supplementalInformation.getChild('CharacterString', XmlService.getNamespace(ns.gco));
          data.mission.supplementalInformation = getText(charString);
        }

        const status = dataIdentification.getChild('status', XmlService.getNamespace(ns.gmd));
        if (status) {
          const progressCode = status.getChild('MD_ProgressCode', XmlService.getNamespace(ns.gmd));
          data.mission.status = getText(progressCode);
        }

        const xlinkNsRc = XmlService.getNamespace('xlink', ns.xlink);
        let docucompPresetParsed = null;
        let hasCc0CreativeCommonsAnchor = false;
        let hasCc0SpdxAnchor = false;
        let plainOtherSlot = 0;

        const rcNodes = dataIdentification.getChildren('resourceConstraints', XmlService.getNamespace(ns.gmd));
        rcNodes.forEach((resourceConstraints) => {
          const hrefAttr = resourceConstraints.getAttribute('href', xlinkNsRc);
          if (hrefAttr && hrefAttr.getValue()) {
            const h = hrefAttr.getValue();
            if (h.indexOf('10bb305d') !== -1) docucompPresetParsed = 'ncei_cc0';
            else if (h.indexOf('551ecbfb') !== -1) docucompPresetParsed = 'ncei_cc_by_4';
            else if (h.indexOf('493b9ff1') !== -1) docucompPresetParsed = 'ncei_cc0_internal_noaa';
            return;
          }

          const legalConstraints = resourceConstraints.getChild('MD_LegalConstraints', XmlService.getNamespace(ns.gmd));
          if (!legalConstraints) return;

          const accessConstraints = legalConstraints.getChild('accessConstraints', XmlService.getNamespace(ns.gmd));
          if (accessConstraints) {
            const restrictionCode = accessConstraints.getChild('MD_RestrictionCode', XmlService.getNamespace(ns.gmd));
            data.mission.accessConstraints = getText(restrictionCode);
          }
          const useLimitation = legalConstraints.getChild('useLimitation', XmlService.getNamespace(ns.gmd));
          if (useLimitation) {
            const charString = useLimitation.getChild('CharacterString', XmlService.getNamespace(ns.gco));
            data.mission.citeAs = getText(charString);
          }

          const otherList = legalConstraints.getChildren('otherConstraints', XmlService.getNamespace(ns.gmd));
          otherList.forEach((otherConstraints) => {
            const anchor = otherConstraints.getChild('Anchor', XmlService.getNamespace(ns.gmx));
            if (anchor) {
              const ha = anchor.getAttribute('href', xlinkNsRc);
              const h = ha ? ha.getValue() : '';
              if (/creativecommons\.org\/publicdomain\/zero/i.test(h) || /\/zero\/1\.0/i.test(h)) {
                hasCc0CreativeCommonsAnchor = true;
              }
              if (/spdx\.org\/licenses\/CC0/i.test(h)) {
                hasCc0SpdxAnchor = true;
              }
              return;
            }
            const charString = otherConstraints.getChild('CharacterString', XmlService.getNamespace(ns.gco));
            const txt = getText(charString);
            if (!txt) return;
            if (/^Data license:\s*/i.test(txt)) {
              data.mission.licenseUrl = txt.replace(/^Data license:\s*/i, '').trim();
              return;
            }
            if (plainOtherSlot === 0) {
              data.mission.distributionLiability = txt;
              plainOtherSlot++;
            } else if (plainOtherSlot === 1) {
              data.mission.otherCiteAs = txt;
              plainOtherSlot++;
            } else {
              data.mission.otherCiteAs = (data.mission.otherCiteAs || '') + '\n' + txt;
            }
          });
        });

        if (hasCc0CreativeCommonsAnchor && hasCc0SpdxAnchor) {
          data.mission.dataLicensePreset =
            docucompPresetParsed === 'ncei_cc0' ? 'cc0_acdo_and_ncei' : 'cc0_acdo';
        } else if (docucompPresetParsed) {
          data.mission.dataLicensePreset = docucompPresetParsed;
        }

        const extentNodes = dataIdentification.getChildren('extent', XmlService.getNamespace(ns.gmd));
        extentNodes.forEach((extent) => {
          const exExtent = extent.getChild('EX_Extent', XmlService.getNamespace(ns.gmd));
          if (!exExtent) return;
          const extDescEl = exExtent.getChild('description', XmlService.getNamespace(ns.gmd));
          if (extDescEl) {
            const charString = extDescEl.getChild('CharacterString', XmlService.getNamespace(ns.gco));
            const ed = getText(charString);
            if (ed) data.spatial.extentDescription = ed;
          }
          const geographicElements = exExtent.getChildren('geographicElement', XmlService.getNamespace(ns.gmd));
          geographicElements.forEach((geographicElement) => {
            const exGeographicDescription = geographicElement.getChild(
              'EX_GeographicDescription',
              XmlService.getNamespace(ns.gmd)
            );
            if (exGeographicDescription) {
              const geographicIdentifier = exGeographicDescription.getChild(
                'geographicIdentifier',
                XmlService.getNamespace(ns.gmd)
              );
              if (geographicIdentifier) {
                const mdIdentifier = geographicIdentifier.getChild('MD_Identifier', XmlService.getNamespace(ns.gmd));
                if (mdIdentifier) {
                  const code = mdIdentifier.getChild('code', XmlService.getNamespace(ns.gmd));
                  if (code) {
                    const charString = code.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                    data.spatial.geographicDescription = getText(charString);
                  }
                }
              }
            }
            const exBoundingBox = geographicElement.getChild('EX_GeographicBoundingBox', XmlService.getNamespace(ns.gmd));
            if (exBoundingBox) {
              const westBound = exBoundingBox.getChild('westBoundLongitude', XmlService.getNamespace(ns.gmd));
              const eastBound = exBoundingBox.getChild('eastBoundLongitude', XmlService.getNamespace(ns.gmd));
              const southBound = exBoundingBox.getChild('southBoundLatitude', XmlService.getNamespace(ns.gmd));
              const northBound = exBoundingBox.getChild('northBoundLatitude', XmlService.getNamespace(ns.gmd));
              data.spatial.boundingBox = {
                lowerLeft: {
                  lon: parseFloat(getText(westBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0),
                  lat: parseFloat(getText(southBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0)
                },
                upperRight: {
                  lon: parseFloat(getText(eastBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0),
                  lat: parseFloat(getText(northBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0)
                },
                upperLeft: {
                  lon: parseFloat(getText(westBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0),
                  lat: parseFloat(getText(northBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0)
                },
                lowerRight: {
                  lon: parseFloat(getText(eastBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0),
                  lat: parseFloat(getText(southBound?.getChild('Decimal', XmlService.getNamespace(ns.gco))) || 0)
                }
              };
            }
          });
          const temporalElement = exExtent.getChild('temporalElement', XmlService.getNamespace(ns.gmd));
          if (temporalElement) {
            const exTemporal = temporalElement.getChild('EX_TemporalExtent', XmlService.getNamespace(ns.gmd));
            if (exTemporal) {
              const innerExtent = exTemporal.getChild('extent', XmlService.getNamespace(ns.gmd));
              if (innerExtent) {
                const timePeriod = innerExtent.getChild('TimePeriod', XmlService.getNamespace(ns.gml));
                if (timePeriod) {
                  const begin = timePeriod.getChild('beginPosition', XmlService.getNamespace(ns.gml));
                  const end = timePeriod.getChild('endPosition', XmlService.getNamespace(ns.gml));
                  if (begin) data.mission.startDate = getText(begin);
                  if (end) data.mission.endDate = getText(end);
                  const ti = timePeriod.getChild('timeInterval', XmlService.getNamespace(ns.gml));
                  if (ti) {
                    const gmlNs = XmlService.getNamespace(ns.gml);
                    const ua = ti.getAttribute('unit', gmlNs);
                    if (ua && ua.getValue()) data.mission.temporalExtentIntervalUnit = ua.getValue();
                    const iv = getText(ti);
                    if (iv) data.mission.temporalExtentIntervalValue = iv;
                  }
                }
              }
            }
          }
          const verticalElement = exExtent.getChild('verticalElement', XmlService.getNamespace(ns.gmd));
          if (verticalElement) {
            const exVertical = verticalElement.getChild('EX_VerticalExtent', XmlService.getNamespace(ns.gmd));
            if (exVertical) {
              const minV = exVertical.getChild('minimumValue', XmlService.getNamespace(ns.gmd));
              const maxV = exVertical.getChild('maximumValue', XmlService.getNamespace(ns.gmd));
              if (minV) {
                const dec = minV.getChild('Decimal', XmlService.getNamespace(ns.gco));
                data.spatial.verticalMinimum = getText(dec);
              }
              if (maxV) {
                const dec = maxV.getChild('Decimal', XmlService.getNamespace(ns.gco));
                data.spatial.verticalMaximum = getText(dec);
              }
              const verticalCRS = exVertical.getChild('verticalCRS', XmlService.getNamespace(ns.gmd));
              if (verticalCRS) {
                const xl = XmlService.getNamespace('xlink', ns.xlink);
                const hrefA = verticalCRS.getAttribute('href', xl);
                if (hrefA && hrefA.getValue()) {
                  data.spatial.verticalCrsXlinkHref = hrefA.getValue();
                } else {
                  const refSystem = verticalCRS.getChild('MD_ReferenceSystem', XmlService.getNamespace(ns.gmd));
                  if (refSystem) {
                    const refId = refSystem.getChild('referenceSystemIdentifier', XmlService.getNamespace(ns.gmd));
                    if (refId) {
                      const rsId = refId.getChild('RS_Identifier', XmlService.getNamespace(ns.gmd));
                      if (rsId) {
                        const crsCode = rsId.getChild('code', XmlService.getNamespace(ns.gmd));
                        if (crsCode) {
                          const charString = crsCode.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                          data.spatial.verticalCrsUrl = getText(charString);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        });
      }
    }

    // Spatial Representation Info
    const spatialRepInfo = root.getChild('spatialRepresentationInfo', XmlService.getNamespace(ns.gmd));
    if (spatialRepInfo) {
      const gridSpatial = spatialRepInfo.getChild('MD_GridSpatialRepresentation', XmlService.getNamespace(ns.gmd));
      if (gridSpatial) {
        const axes = [];
        const axisProps = gridSpatial.getChildren('axisDimensionProperties', XmlService.getNamespace(ns.gmd));
        axisProps.forEach((ap) => {
          const mdDim = ap.getChild('MD_Dimension', XmlService.getNamespace(ns.gmd));
          if (!mdDim) return;
          const dimName = mdDim.getChild('dimensionName', XmlService.getNamespace(ns.gmd));
          const nameCode = dimName ? dimName.getChild('MD_DimensionNameTypeCode', XmlService.getNamespace(ns.gmd)) : null;
          const dimSize = mdDim.getChild('dimensionSize', XmlService.getNamespace(ns.gmd));
          const intEl = dimSize ? dimSize.getChild('Integer', XmlService.getNamespace(ns.gco)) : null;
          const resolution = mdDim.getChild('resolution', XmlService.getNamespace(ns.gmd));
          const resStr = resolution
            ? getText(resolution.getChild('CharacterString', XmlService.getNamespace(ns.gco)))
            : '';
          axes.push({
            name: nameCode ? getText(nameCode) : 'row',
            size: intEl ? getText(intEl) : '0',
            resolution: resStr
          });
        });
        const cg = gridSpatial.getChild('cellGeometry', XmlService.getNamespace(ns.gmd));
        const cgCode = cg ? cg.getChild('MD_CellGeometryCode', XmlService.getNamespace(ns.gmd)) : null;
        data.spatial.gridRepresentation = {
          cellGeometry: cgCode ? getText(cgCode) : 'area',
          axes: axes
        };
      }
      const georectified = spatialRepInfo.getChild('MD_Georectified', XmlService.getNamespace(ns.gmd));
      if (georectified) {
        const numberOfDimensions = georectified.getChild('numberOfDimensions', XmlService.getNamespace(ns.gmd));
        if (numberOfDimensions) {
          const integer = numberOfDimensions.getChild('Integer', XmlService.getNamespace(ns.gco));
          data.spatial.dimensions = parseInt(getText(integer)) || 2;
        }
        const pointContainers = georectified.getChildren('cornerPoints', XmlService.getNamespace(ns.gmd));
        const directPoints = georectified.getChildren('Point', XmlService.getNamespace(ns.gml));
        const points = [];
        pointContainers.forEach((container) => {
          const gmlPoint = container.getChild('Point', XmlService.getNamespace(ns.gml));
          if (gmlPoint) points.push(gmlPoint);
        });
        directPoints.forEach((gmlPoint) => points.push(gmlPoint));

        points.forEach(gmlPoint => {
          if (gmlPoint) {
            const identifier = gmlPoint.getChild('id', XmlService.getNamespace(ns.gml));
            const coordinates = gmlPoint.getChild('coordinates', XmlService.getNamespace(ns.gml));
            const pos = gmlPoint.getChild('pos', XmlService.getNamespace(ns.gml));
            const id = gmlPoint.getAttribute('id')?.getValue() || (identifier ? (identifier.getAttribute('codeSpace')?.getValue() || getText(identifier)) : '');
            const coordText = getText(pos) || getText(coordinates);
            if (id && coordText) {
              const coords = coordText.split(/\s+/).map(parseFloat);
              if (coords.length >= 2) {
                const [lon, lat] = coords;
                if (id === 'cornerPoint-upper-left') {
                  data.spatial.boundingBox.upperLeft = { lon, lat };
                } else if (id === 'cornerPoint-upper-right') {
                  data.spatial.boundingBox.upperRight = { lon, lat };
                } else if (id === 'cornerPoint-lower-right') {
                  data.spatial.boundingBox.lowerRight = { lon, lat };
                } else if (id === 'cornerPoint-lower-left') {
                  data.spatial.boundingBox.lowerLeft = { lon, lat };
                }
              }
            }
          }
        });
      }
    }

    // Acquisition Info
    const acquisitionInfo = root.getChild('acquisitionInformation', XmlService.getNamespace(ns.gmi));
    if (acquisitionInfo) {
      const miAcquisitionInfo = acquisitionInfo.getChild('MI_AcquisitionInformation', XmlService.getNamespace(ns.gmi));
      if (miAcquisitionInfo) {
        /**
         * Parse one gmi:MI_Instrument (top-level or nested under MI_Platform).
         * @returns {object|null}
         */
        const parseOneMiInstrument = (miInstrument) => {
          if (!miInstrument) return null;
          const sensor = {};
          const identifier = miInstrument.getChild('identifier', XmlService.getNamespace(ns.gmd));
          if (identifier) {
            const mdIdentifier = identifier.getChild('MD_Identifier', XmlService.getNamespace(ns.gmd));
            if (mdIdentifier) {
              const code = mdIdentifier.getChild('code', XmlService.getNamespace(ns.gmd));
              if (code) {
                const charString = code.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                sensor.id = getText(charString);
              }
            }
          }
          const type = miInstrument.getChild('type', XmlService.getNamespace(ns.gmi));
          if (type) {
            let charString = type.getChild('CharacterString', XmlService.getNamespace(ns.gco));
            if (!charString) {
              charString = type.getChild('CharacterString', XmlService.getNamespace(ns.gmi));
            }
            sensor.type = getText(charString);
          }
          const description = miInstrument.getChild('description', XmlService.getNamespace(ns.gmd));
          if (description) {
            const charString = description.getChild('CharacterString', XmlService.getNamespace(ns.gco));
            const descText = getText(charString);
            sensor.description = descText;
            const lines = descText.split('\n');
            lines.forEach((line) => {
              const trimmedLine = line.trim();
              if (trimmedLine.includes('Firmware Version')) {
                sensor.firmware = trimmedLine.split('Firmware Version:')[1]?.trim() || '';
              } else if (trimmedLine.includes('Operation Mode')) {
                sensor.operationMode = trimmedLine.split('Operation Mode:')[1]?.trim() || '';
              } else if (trimmedLine.includes('Uncertainty Estimate')) {
                sensor.uncertainty = trimmedLine.split('Uncertainty Estimate:')[1]?.trim() || '';
              } else if (trimmedLine.includes('Frequency')) {
                sensor.frequency = trimmedLine.split('Frequency:')[1]?.trim() || '';
              } else if (trimmedLine.includes('Beam Count')) {
                sensor.beamCount = parseInt(trimmedLine.split('Beam Count:')[1]?.trim()) || 0;
              } else if (trimmedLine.includes('Depth Rating')) {
                sensor.depthRating = trimmedLine.split('Depth Rating:')[1]?.trim() || '';
              } else if (trimmedLine.includes('Confidence Interval')) {
                sensor.confidenceInterval = trimmedLine.split('Confidence Interval:')[1]?.trim() || '';
              }
            });
          }
          const history = miInstrument.getChild('history', XmlService.getNamespace(ns.gmi));
          if (history) {
            const eventList = history.getChild('MI_InstrumentationEventList', XmlService.getNamespace(ns.gmi));
            if (eventList) {
              const citation = eventList.getChild('citation', XmlService.getNamespace(ns.gmd));
              if (citation) {
                const ciCitation = citation.getChild('CI_Citation', XmlService.getNamespace(ns.gmd));
                if (ciCitation) {
                  const date = ciCitation.getChild('date', XmlService.getNamespace(ns.gmd));
                  if (date) {
                    const ciDate = date.getChild('CI_Date', XmlService.getNamespace(ns.gmd));
                    if (ciDate) {
                      const dateElement = ciDate.getChild('date', XmlService.getNamespace(ns.gmd));
                      if (dateElement) {
                        const dateTime = dateElement.getChild('DateTime', XmlService.getNamespace(ns.gco));
                        sensor.installDate = getText(dateTime);
                      }
                    }
                  }
                }
              }
              const eventDesc = eventList.getChild('description', XmlService.getNamespace(ns.gmd));
              if (eventDesc) {
                const charString = eventDesc.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                sensor.event = getText(charString);
              }
              const locale = eventList.getChild('locale', XmlService.getNamespace(ns.gmd));
              if (locale) {
                const ptLocale = locale.getChild('PT_Locale', XmlService.getNamespace(ns.gmd));
                if (ptLocale) {
                  const language = ptLocale.getChild('language', XmlService.getNamespace(ns.gmd));
                  if (language) {
                    const languageCode = language.getChild('LanguageCode', XmlService.getNamespace(ns.gmd));
                    sensor.sensorLanguage = getText(languageCode);
                  }
                  const characterEncoding = ptLocale.getChild('characterEncoding', XmlService.getNamespace(ns.gmd));
                  if (characterEncoding) {
                    const charSetCode = characterEncoding.getChild('MD_CharacterSetCode', XmlService.getNamespace(ns.gmd));
                    sensor.sensorCharacterSet = getText(charSetCode);
                  }
                }
              }
            }
          }
          if (sensor.id || sensor.type) {
            return sensor;
          }
          return null;
        };

        const platform = miAcquisitionInfo.getChild('platform', XmlService.getNamespace(ns.gmi));
        if (platform) {
          const miPlatform = platform.getChild('MI_Platform', XmlService.getNamespace(ns.gmi));
          if (miPlatform) {
            const identifier = miPlatform.getChild('identifier', XmlService.getNamespace(ns.gmd));
            if (identifier) {
              const mdIdentifier = identifier.getChild('MD_Identifier', XmlService.getNamespace(ns.gmd));
              if (mdIdentifier) {
                const code = mdIdentifier.getChild('code', XmlService.getNamespace(ns.gmd));
                if (code) {
                  const charString = code.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                  data.platform.id = getText(charString);
                }
              }
            }
            const description = miPlatform.getChild('description', XmlService.getNamespace(ns.gmd));
            if (description) {
              const charString = description.getChild('CharacterString', XmlService.getNamespace(ns.gco));
              data.platform.name = getText(charString);
            }
            const sponsor = miPlatform.getChild('pointOfContact', XmlService.getNamespace(ns.gmd));
            if (sponsor) {
              const responsibleParty = sponsor.getChild('CI_ResponsibleParty', XmlService.getNamespace(ns.gmd));
              if (responsibleParty) {
                const orgName = responsibleParty.getChild('organisationName', XmlService.getNamespace(ns.gmd));
                if (orgName) {
                  const charString = orgName.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                  data.platform.manufacturer = getText(charString);
                }
              }
            }
            const otherProperty = miPlatform.getChild('otherProperty', XmlService.getNamespace(ns.gmi));
            if (otherProperty) {
              const record = otherProperty.getChild('Record', XmlService.getNamespace(ns.gco));
              if (record) {
                const characteristics = record.getChild('otherProperty', XmlService.getNamespace(ns.gmi));
                if (characteristics) {
                  const characteristicList = characteristics.getChild('CharacteristicList', XmlService.getNamespace(ns.gmi));
                  if (characteristicList) {
                    const fields = characteristicList.getChildren('characteristic', XmlService.getNamespace(ns.gmi));
                    fields.forEach(field => {
                      const name = field.getAttribute('name')?.getValue();
                      if (name === 'Weight') {
                        const quantity = field.getChild('Quantity', XmlService.getNamespace(ns.gmi));
                        if (quantity) {
                          const value = quantity.getChild('Decimal', XmlService.getNamespace(ns.gco));
                          data.platform.weight = parseFloat(getText(value)) || 0;
                        }
                      } else if (name === 'Length') {
                        const quantity = field.getChild('Quantity', XmlService.getNamespace(ns.gmi));
                        if (quantity) {
                          const value = quantity.getChild('Decimal', XmlService.getNamespace(ns.gco));
                          data.platform.length = parseFloat(getText(value)) || 0;
                        }
                      } else if (name === 'Width') {
                        const quantity = field.getChild('Quantity', XmlService.getNamespace(ns.gmi));
                        if (quantity) {
                          const value = quantity.getChild('Decimal', XmlService.getNamespace(ns.gco));
                          data.platform.width = parseFloat(getText(value)) || 0;
                        }
                      } else if (name === 'Height') {
                        const quantity = field.getChild('Quantity', XmlService.getNamespace(ns.gmi));
                        if (quantity) {
                          const value = quantity.getChild('Decimal', XmlService.getNamespace(ns.gco));
                          data.platform.height = parseFloat(getText(value)) || 0;
                        }
                      } else if (name === 'CasingMaterial') {
                        const category = field.getChild('Category', XmlService.getNamespace(ns.gmi));
                        if (category) {
                          const value = category.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                          data.platform.material = getText(value);
                        }
                      } else if (name === 'SpeedOverWater') {
                        const quantity = field.getChild('Quantity', XmlService.getNamespace(ns.gmi));
                        if (quantity) {
                          const value = quantity.getChild('Decimal', XmlService.getNamespace(ns.gco));
                          data.platform.speed = parseFloat(getText(value)) || 0;
                        }
                      } else if (name === 'OperationalArea') {
                        const text = field.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                        data.platform.operationalArea = getText(text);
                      }
                    });
                  }
                }
              }
            }
          }
        }

        const instruments = miAcquisitionInfo.getChildren('instrument', XmlService.getNamespace(ns.gmi));
        instruments.forEach((instrument) => {
          const miInstrument = instrument.getChild('MI_Instrument', XmlService.getNamespace(ns.gmi));
          const sensor = parseOneMiInstrument(miInstrument);
          if (sensor) data.sensors.push(sensor);
        });

        const platformWrapper = miAcquisitionInfo.getChild('platform', XmlService.getNamespace(ns.gmi));
        if (platformWrapper) {
          const miPlat = platformWrapper.getChild('MI_Platform', XmlService.getNamespace(ns.gmi));
          if (miPlat) {
            const platformInstruments = miPlat.getChildren('instrument', XmlService.getNamespace(ns.gmi));
            platformInstruments.forEach((instrument) => {
              const miInstrument = instrument.getChild('MI_Instrument', XmlService.getNamespace(ns.gmi));
              const sensor = parseOneMiInstrument(miInstrument);
              if (sensor) data.sensors.push(sensor);
            });
          }
        }
      }
    }

    // Content info (NOAA-style MI_CoverageDescription) — merge band metadata into sensors by index
    const contentInfoRoot = root.getChild('contentInfo', XmlService.getNamespace(ns.gmd));
    if (contentInfoRoot) {
      const cov = contentInfoRoot.getChild('MI_CoverageDescription', XmlService.getNamespace(ns.gmi));
      if (cov) {
        const dims = cov.getChildren('dimension', XmlService.getNamespace(ns.gmd));
        dims.forEach((dim, idx) => {
          const band = dim.getChild('MD_Band', XmlService.getNamespace(ns.gmd));
          if (!band) return;
          let variableName = '';
          let dataType = '';
          const seq = band.getChild('sequenceIdentifier', XmlService.getNamespace(ns.gmd));
          if (seq) {
            const mn = seq.getChild('MemberName', XmlService.getNamespace(ns.gco));
            if (mn) {
              const an = mn.getChild('aName', XmlService.getNamespace(ns.gco));
              if (an) {
                const cs = an.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                variableName = getText(cs) || getText(an);
              }
              const at = mn.getChild('attributeType', XmlService.getNamespace(ns.gco));
              if (at) {
                const tn = at.getChild('TypeName', XmlService.getNamespace(ns.gco));
                if (tn) {
                  const an2 = tn.getChild('aName', XmlService.getNamespace(ns.gco));
                  if (an2) {
                    const cs2 = an2.getChild('CharacterString', XmlService.getNamespace(ns.gco));
                    dataType = getText(cs2) || getText(an2);
                  }
                }
              }
            }
          }
          const desc = band.getChild('descriptor', XmlService.getNamespace(ns.gmd));
          const descriptor = desc
            ? getText(desc.getChild('CharacterString', XmlService.getNamespace(ns.gco)))
            : '';
          if (!data.sensors[idx]) data.sensors[idx] = {};
          const target = data.sensors[idx];
          if (variableName) target.variableName = variableName;
          if (dataType) target.dataType = dataType;
          if (descriptor) target.coverageDescriptor = descriptor;
        });
      }
    }

    // Data Quality Info
    const dataQualityInfo = root.getChild('dataQualityInfo', XmlService.getNamespace(ns.gmd));
    if (dataQualityInfo) {
      const dqDataQuality = dataQualityInfo.getChild('DQ_DataQuality', XmlService.getNamespace(ns.gmd));
      if (dqDataQuality) {
        const reports = dqDataQuality.getChildren('report', XmlService.getNamespace(ns.gmd));
        reports.forEach(report => {
          const quantitativeAccuracy = report.getChild('DQ_QuantitativeAttributeAccuracy', XmlService.getNamespace(ns.gmd));
          if (quantitativeAccuracy) {
            const result = quantitativeAccuracy.getChild('result', XmlService.getNamespace(ns.gmd));
            if (result) {
              const dqResult = result.getChild('DQ_QuantitativeResult', XmlService.getNamespace(ns.gmd));
              if (dqResult) {
                const valueType = dqResult.getChild('valueType', XmlService.getNamespace(ns.gco));
                if (valueType) {
                  const recordType = valueType.getChild('RecordType', XmlService.getNamespace(ns.gco));
                  data.spatial.accuracyStandard = getText(recordType);
                }
                const value = dqResult.getChild('value', XmlService.getNamespace(ns.gco));
                if (value) {
                  const record = value.getChild('Record', XmlService.getNamespace(ns.gco));
                  if (record) {
                    const quantity = record.getChild('Quantity', XmlService.getNamespace(ns.gmi));
                    if (quantity) {
                      const qValue = quantity.getChild('Decimal', XmlService.getNamespace(ns.gco));
                      data.spatial.accuracyValue = parseFloat(getText(qValue)) || 0;
                    }
                  }
                }
              }
            }
          }
          const positionalAccuracy = report.getChild('DQ_AbsoluteExternalPositionalAccuracy', XmlService.getNamespace(ns.gmd));
          if (positionalAccuracy) {
            const result = positionalAccuracy.getChild('result', XmlService.getNamespace(ns.gmd));
            if (result) {
              const dqResult = result.getChild('DQ_QuantitativeResult', XmlService.getNamespace(ns.gmd));
              if (dqResult) {
                const valueType = dqResult.getChild('valueType', XmlService.getNamespace(ns.gco));
                if (valueType) {
                  const recordType = valueType.getChild('RecordType', XmlService.getNamespace(ns.gco));
                  data.spatial.errorLevel = getText(recordType);
                }
                const value = dqResult.getChild('value', XmlService.getNamespace(ns.gco));
                if (value) {
                  const record = value.getChild('Record', XmlService.getNamespace(ns.gco));
                  if (record) {
                    const quantity = record.getChild('Quantity', XmlService.getNamespace(ns.gmi));
                    if (quantity) {
                      const qValue = quantity.getChild('Decimal', XmlService.getNamespace(ns.gco));
                      data.spatial.errorValue = parseFloat(getText(qValue)) || 0;
                    }
                  }
                }
              }
            }
          }
        });
      }
    }
  }
}

class SchemaValidator extends ValidationEngine {
  constructor(schema = 'iso19115-2') {
    super();
    this.schema = ISO_SCHEMAS[schema] || ISO_SCHEMAS['iso19115-2'];
  }

  validateXML(xmlString, level = 'basic') {
    try {
      Logger.log(`INFO: SchemaValidator - Validating XML for schema: ${this.schema.version}`);
      const doc = XmlService.parse(xmlString);
      const root = doc.getRootElement();
      const namespace = root.getNamespace();

      if (namespace.getURI() !== this.schema.namespaces[this.schema.rootElement.split(':')[0]]) {
        return {
          valid: false,
          errors: [{ message: `Invalid root namespace. Expected ${this.schema.namespaces[this.schema.rootElement.split(':')[0]]}, got ${namespace.getURI()}` }],
          warnings: [],
          infos: [],
          summary: 'Invalid XML schema'
        };
      }

      const parser = new UniversalXMLParser();
      const { data } = parser.parse(xmlString);
      return this.validate(data, { level });
    } catch (error) {
      Logger.log(`ERROR: SchemaValidator - Validation failed: ${error.message}`);
      return {
        valid: false,
        errors: [{ message: `XML validation failed: ${error.message}` }],
        warnings: [],
        infos: [],
        summary: 'Invalid XML structure'
      };
    }
  }
}

function detectNamespaceMixingErrors(xmlString, schemaKey) {
  const xml = String(xmlString || '');
  const errors = [];
  const hasIso3Prefixes = /<(?:\/)?(?:mdb|mri|cit|gex|mcc|mco|mac|lan):/i.test(xml);

  if (schemaKey === 'iso19115-2' && hasIso3Prefixes) {
    errors.push({ message: 'Namespace mixing detected: document includes unsupported legacy prefixes (mdb/mri/cit/...).'});
  }

  return errors;
}

function detectStructuralSpineErrors(xmlString, schemaKey, level) {
  if (level !== 'strict') {
    return [];
  }

  const xml = String(xmlString || '');
  const errors = [];
  const gmd = '(?:gmd:)?';
  const checks = [
    { label: 'fileIdentifier', regex: new RegExp(`<(?:\\/)?${gmd}fileIdentifier\\b`, 'i') },
    { label: 'dateStamp', regex: new RegExp(`<(?:\\/)?${gmd}dateStamp\\b`, 'i') },
    { label: 'hierarchyLevel', regex: new RegExp(`<(?:\\/)?${gmd}hierarchyLevel\\b`, 'i') },
    { label: 'identificationInfo', regex: new RegExp(`<(?:\\/)?${gmd}identificationInfo\\b`, 'i') },
    {
      label: 'citation/title',
      regex: new RegExp(
        `<(?:\\/)?${gmd}citation\\b[\\s\\S]*?<(?:\\/)?${gmd}title\\b`,
        'i'
      )
    },
    { label: 'extent', regex: new RegExp(`<(?:\\/)?${gmd}extent\\b`, 'i') },
    { label: 'distributionInfo', regex: new RegExp(`<(?:\\/)?${gmd}distributionInfo\\b`, 'i') },
    { label: 'metadataMaintenance', regex: new RegExp(`<(?:\\/)?${gmd}metadataMaintenance\\b`, 'i') }
  ];

  checks.forEach((check) => {
    if (!check.regex.test(xml)) {
      errors.push({ message: `Strict structural check failed: missing required ${check.label} element.` });
    }
  });

  return errors;
}

// Integration functions
function generateXMLWithSchema(data, schema = 'iso19115-2', options) {
  logDebug(`DEBUG: generateXMLWithSchema - Generating XML for schema: ${schema}`);

  const alreadyMapped = options && options.alreadyMapped === true;
  const mappedData = alreadyMapped ? data : requireMapClientDataToServer()(data);
  if (mappedData == null || typeof mappedData !== 'object') {
    throw new Error('generateXMLWithSchema: data mapping produced no object (pass a valid payload or alreadyMapped with full structure)');
  }
  logDebug(
    'DEBUG: generateXMLWithSchema - Data keys: mission.id=' +
      (mappedData.mission && mappedData.mission.id) +
      ', platform.id=' +
      (mappedData.platform && mappedData.platform.id)
  );

  const generator = new UniversalXMLGenerator(schema);
  return generator.generate(mappedData);
}

function validateXMLWithSchema(xmlString, schema = null, level = 'basic') {
  logDebug(`DEBUG: validateXMLWithSchema - Validating XML, schema: ${schema}, level: ${level}`);
  if (xmlString == null || String(xmlString).trim() === '') {
    return {
      valid: false,
      errors: [{ message: 'XML input is empty or null' }],
      summary: 'No XML to validate'
    };
  }
  const parser = new UniversalXMLParser();
  const { detectedSchema } = parser.parse(xmlString);
  const activeSchema = schema || detectedSchema || 'iso19115-2';
  const validator = new SchemaValidator(activeSchema);
  const baseResult = validator.validateXML(xmlString, level);

  const namespaceErrors = detectNamespaceMixingErrors(xmlString, activeSchema);
  const structuralErrors = detectStructuralSpineErrors(xmlString, activeSchema, level);
  const extraErrors = [...namespaceErrors, ...structuralErrors];

  if (extraErrors.length === 0) {
    return baseResult;
  }

  const mergedErrors = [...(baseResult.errors || []), ...extraErrors];
  const mergedResult = {
    ...baseResult,
    valid: false,
    errors: mergedErrors,
    summary: `Found ${mergedErrors.length} error${mergedErrors.length !== 1 ? 's' : ''}`
  };

  return mergedResult;
}

function parseXMLWithAutoDetection(xmlString) {
  logDebug(`DEBUG: parseXMLWithAutoDetection - Parsing XML with auto-detection`);
  const parser = new UniversalXMLParser();
  return parser.parse(xmlString);
}

function assertNoDuplicateRootNamespaces(xmlString, requiredPrefixes = ['gmi', 'gmd', 'gco']) {
  const xmlWithoutProlog = String(xmlString || '')
    .replace(/^\uFEFF/, '')
    .replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, '')
    .replace(/^\s*<!--[\s\S]*?-->\s*/g, '')
    .trim();

  if (!xmlWithoutProlog) {
    Logger.log('WARN: assertNoDuplicateRootNamespaces - XML is empty or whitespace only; skipping check');
    return;
  }

  const rootMatch = xmlWithoutProlog.match(/<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\b[^>]*>/);
  if (!rootMatch) {
    throw new Error(
      'Converted XML sanity check failed: could not locate root element. ' +
        'Pass a non-empty XML string whose first element is the document root (e.g. <gmi:MI_Metadata ...>).'
    );
  }

  const rootTag = rootMatch[0];
  const namespaceAttrRegex = /\sxmlns:([A-Za-z_][\w.-]*)="[^"]*"/g;
  const seenPrefixes = {};
  const duplicatePrefixes = [];
  let match;

  while ((match = namespaceAttrRegex.exec(rootTag)) !== null) {
    const prefix = match[1];
    if (seenPrefixes[prefix]) {
      duplicatePrefixes.push(prefix);
    } else {
      seenPrefixes[prefix] = true;
    }
  }

  if (duplicatePrefixes.length > 0) {
    throw new Error(`Converted XML sanity check failed: duplicate root namespace declarations: ${duplicatePrefixes.join(', ')}`);
  }

  const missingPrefixes = requiredPrefixes.filter((prefix) => !seenPrefixes[prefix]);
  if (missingPrefixes.length > 0) {
    throw new Error(`Converted XML sanity check failed: missing required root namespace declarations: ${missingPrefixes.join(', ')}`);
  }
}

function convertXMLSchema(xmlString, targetSchema) {
  try {
    logDebug(`DEBUG: convertXMLSchema - Converting XML to schema: ${targetSchema}`);

    // Single-schema mode: no conversion required.
    if (!targetSchema || targetSchema === 'iso19115-2') {
      Logger.log('INFO: convertXMLSchema - Single-schema mode active; returning XML unchanged');
      return xmlString;
    }

    Logger.log('WARN: convertXMLSchema - Unsupported target schema, returning original');
    return xmlString;
  } catch (error) {
    Logger.log(`ERROR: convertXMLSchema - Conversion failed: ${error.message}`);
    throw new Error(`Schema conversion failed: ${error.message}`);
  }
}

function assertSchemaHealthAccess() {
  try {
    const effectiveUser = Session.getEffectiveUser();
    const userEmail = effectiveUser ? effectiveUser.getEmail() : '';
    if (userEmail && String(userEmail).trim()) {
      return String(userEmail).trim();
    }
  } catch (error) {
    Logger.log(`WARN: assertSchemaHealthAccess - getEffectiveUser unavailable: ${error.message}`);
  }

  try {
    const temporaryUserKey = Session.getTemporaryActiveUserKey();
    if (temporaryUserKey && String(temporaryUserKey).trim()) {
      return `temp:${String(temporaryUserKey).trim()}`;
    }
  } catch (error) {
    Logger.log(`WARN: assertSchemaHealthAccess - getTemporaryActiveUserKey unavailable: ${error.message}`);
  }

  throw new Error('Schema health checks are restricted to authenticated project users.');
}

function buildSchemaHealthSampleData() {
  assertSchemaHealthAccess();
  return {
    mission: {
      missionId: 'SMOKE-001',
      missionTitle: 'Smoke Test Mission',
      abstract: 'Round-trip schema conversion smoke test data',
      startDate: '2024-01-01T00:00',
      endDate: '2024-01-01T01:00',
      language: 'eng',
      characterSet: 'utf8',
      organization: 'Smoke Test Org',
      contactEmail: 'smoke@test.local',
      contactAddress: '123 Test Lane'
    },
    platform: {
      platformId: 'PLAT-001',
      platformName: 'Test Platform'
    },
    sensors: [
      {
        id: 'SNS-001',
        type: 'multibeam'
      }
    ],
    spatial: {
      boundingBox: {
        lowerLeft: { lon: -1, lat: -1 },
        upperRight: { lon: 1, lat: 1 }
      }
    },
    output: {
      outputFormat: 'xml',
      validationLevel: 'basic',
      saveAsTemplate: false
    }
  };
}

function runSchemaRoundTripHealthCheck(startSchema, targetSchema, sampleData = null) {
  assertSchemaHealthAccess();
  const start = startSchema || 'iso19115-2';
  const target = targetSchema != null && targetSchema !== '' ? targetSchema : 'iso19115-2';
  try {
    const data = sampleData || buildSchemaHealthSampleData();
    const generatedXml = generateXMLWithSchema(data, start);
    const convertedXml = convertXMLSchema(generatedXml, target);

    const parseResult = parseXMLWithAutoDetection(convertedXml);
    const detectedSchema = parseResult?.detectedSchema || 'unknown';

    return {
      ok: detectedSchema === target,
      startSchema: start,
      targetSchema: target,
      detectedSchema,
      generatedXmlLength: generatedXml ? generatedXml.length : 0,
      convertedXmlLength: convertedXml ? convertedXml.length : 0,
      missionId: parseResult?.data?.mission?.id || null,
      platformId: parseResult?.data?.platform?.id || null,
      message:
        detectedSchema === target
          ? `Round-trip succeeded: ${start} -> ${target} -> ${detectedSchema}`
          : `Round-trip schema mismatch: expected ${target}, got ${detectedSchema}`
    };
  } catch (error) {
    return {
      ok: false,
      startSchema: start,
      targetSchema: target,
      message: `Round-trip failed: ${error.message}`,
      error: error.message
    };
  }
}

function runAllSchemaRoundTripHealthChecks(sampleData = null) {
  assertSchemaHealthAccess();
  const tests = [
    runSchemaRoundTripHealthCheck('iso19115-2', 'iso19115-2', sampleData),
    runSchemaRoundTripHealthCheck('iso19115-2', 'iso19115-2', sampleData)
  ];

  const allPassed = tests.every((t) => t.ok);
  return {
    ok: allPassed,
    summary: allPassed ? 'All schema round-trip smoke tests passed' : 'One or more schema round-trip smoke tests failed',
    tests
  };
}

function runSchemaHealthChecks() {
  const caller = assertSchemaHealthAccess();
  const result = runAllSchemaRoundTripHealthChecks();
  Logger.log(`INFO: runSchemaHealthChecks - caller=${caller} | ${result.summary}`);

  result.tests.forEach((test, index) => {
    const status = test.ok ? 'PASS' : 'FAIL';
    Logger.log(
      `INFO: runSchemaHealthChecks - [${index + 1}] ${status} ${test.startSchema} -> ${test.targetSchema} | detected=${test.detectedSchema || 'unknown'} | ${test.message}`
    );
  });

  return result;
}

function runSingleSchemaHealthCheck(startSchema, targetSchema) {
  const caller = assertSchemaHealthAccess();
  const result = runSchemaRoundTripHealthCheck(
    startSchema || 'iso19115-2',
    targetSchema != null && targetSchema !== '' ? targetSchema : 'iso19115-2'
  );
  const status = result.ok ? 'PASS' : 'FAIL';
  Logger.log(
    `INFO: runSingleSchemaHealthCheck - caller=${caller} | ${status} ${result.startSchema} -> ${result.targetSchema} | detected=${result.detectedSchema || 'unknown'} | ${result.message}`
  );
  return result;
}

function xmlHasBoundingBoxDecimal_(xml, localName) {
  const prefixed = new RegExp(
    `<\\w+:${localName}\\b[^>]*>\\s*<\\w+:Decimal\\b`,
    'i'
  );
  const unprefixed = new RegExp(`<${localName}\\b[^>]*>\\s*<Decimal\\b`, 'i');
  return prefixed.test(xml) || unprefixed.test(xml);
}

function runIso19115_2OutputSanityCheck(sampleData = null) {
  const caller = assertSchemaHealthAccess();
  const data = sampleData || buildSchemaHealthSampleData();
  const xml = generateXMLWithSchema(data, 'iso19115-2');

  const checks = [
    {
      id: 'root.prefixed',
      description: 'Root element is gmi:MI_Metadata',
      passed: /<gmi:MI_Metadata\b/.test(xml)
    },
    {
      id: 'root.namespace.gmi',
      description: 'gmi namespace declaration is present',
      passed: /xmlns:gmi="http:\/\/www\.isotc211\.org\/2005\/gmi"/.test(xml)
    },
    {
      id: 'schema.gmi',
      description: 'schemaLocation includes gmi schema',
      passed: /http:\/\/www\.isotc211\.org\/2005\/gmi\s+http:\/\/schemas\.opengis\.net\/iso\/19115\/-2\/gmi\/1\.0\/gmi\.xsd/.test(xml)
    },
    {
      id: 'bbox.decimalTyped',
      description: 'Bounding box corners use Decimal (prefixed ns* or unprefixed per XmlService)',
      passed:
        xmlHasBoundingBoxDecimal_(xml, 'westBoundLongitude') &&
        xmlHasBoundingBoxDecimal_(xml, 'eastBoundLongitude') &&
        xmlHasBoundingBoxDecimal_(xml, 'southBoundLatitude') &&
        xmlHasBoundingBoxDecimal_(xml, 'northBoundLatitude')
    }
  ];

  const failedChecks = checks.filter((check) => !check.passed);
  const ok = failedChecks.length === 0;
  const result = {
    ok,
    caller,
    schema: 'iso19115-2',
    checks,
    generatedXmlLength: xml.length,
    message: ok
      ? 'ISO 19115-2 output sanity check passed'
      : `ISO 19115-2 output sanity check failed: ${failedChecks.map((check) => check.id).join(', ')}`
  };

  Logger.log(`INFO: runIso19115_2OutputSanityCheck - ${result.message}`);
  return result;
}

// Backward-compatible wrapper for existing debug tooling.
function runIso19115_3OutputSanityCheck(sampleData = null) {
  return runIso19115_2OutputSanityCheck(sampleData);
}
