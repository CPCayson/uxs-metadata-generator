# NCEI UxS placeholder workbook (extracted rows)

Source file: [`Metadata Placeholders and Script Generation.xlsx`](../../Metadata%20Placeholders%20and%20Script%20Generation.xlsx) (shipped with this repo; official copy from [NCEI UxS templates](https://www.ncei.noaa.gov/products/uncrewed-system-metadata-templates)).

Columns mirror the spreadsheet: **Element / tag**, **Placeholder text**, **Description**.

For `pilotState` / `importPilotPartialStateFromXml` coverage, see [uxs-ncei-template-mission-pilot-matrix.md](./uxs-ncei-template-mission-pilot-matrix.md).

| # | Element / tag | Placeholder text | Description |
| --: | -- | -- | -- |
| 2 | fileIdentifier | Unique Identifier Assigned to Metadata Record | Unique ID for the file (e.g., UUID). |
| 3 | dateStamp | Date TIme | Resource Metadata Date |
| 4 | dimensionSize | Column Dimension Size |  Number of elements along the axes |
| 5 | resolution | UNIT 99 |  Degree of detail in the grid dataset |
| 6 | dimensionSize | Row Dimension Size |  Number of elements along the axes |
| 7 | resolution | UNIT 99 |  Degree of detail in the grid dataset |
| 8 | dimensionSize | Vertical Dimension Size |  Number of elements along the axes |
| 9 | resolution | UNIT 99 |  Degree of detail in the grid dataset |
| 10 | title | Aquisition (data collection) entity should be globally unique | Title of the acquisition/collection. |
| 11 | date | Creation Date of Dataset | Creation Date of Dataset |
| 12 | date | Publication Date of Dataset | Publication Date of Dataset |
| 13 | MD_Identifier - code | DOI | The Digital Object Identifier URL |
| 14 | MD_Identifier - code | identifier | NCEI Accession ID. |
| 15 | MD_Identifier - code | Unique Identifier Assigned to Metadata Record | NCEI Metadata ID - same as file identifier |
| 16 | individualName | POC for Dataset | Name of Point of Contact (Author). |
| 17 | organisationName | POC's Org | Organization of Point of Contact. |
| 18 | electronicMailAddress | POC Email | Email address of Point of Contact. |
| 19 | URL | Website for POC's Org | Website URL for the organization. |
| 20 | protocol | The connection protocol to be used such as http, ftp, etc. | Protocol for the URL |
| 21 | name | Background Information Name of the online resource | Website name/ title |
| 22 | description | Background information from the source. Description of the online resource that provides the resource sought | Description of the website |
| 23 | individualName | POC for Dataset | Name of Point of Contact (Originator). |
| 24 | organisationName | POC's Org | Organization of Point of Contact. |
| 25 | electronicMailAddress | POC Email | Email address of Point of Contact. |
| 26 | URL | Website for POC's Org | Website URL for the organization. |
| 27 | protocol | The connection protocol to be used such as http, ftp, etc. | Protocol for the URL |
| 28 | name | Background Information Name of the online resource | Website name/ title |
| 29 | description | Background information from the source. Description of the online resource that provides the resource sought | Description of the website |
| 30 | abstract | Not a scientific abstract. Describe dataset, goals of mission. | General description of the dataset. |
| 31 | purpose | Not a scientific abstract. Describe collection purpose/overarching project. | Why the data was collected. |
| 32 | individualName | AT LEAST ONE OF ORGANISATION, INDIVIDUAL OR POSITION | Contact Person/Org for inquiries. |
| 33 | organisationName | AT LEAST ONE OF ORGANISATION, INDIVIDUAL OR POSITION | Contact Person/Org for inquiries. |
| 34 | electronicMailAddress | Contact Email for Responsible Party or Org | Contact email. |
| 35 | URL | website for Responsible Party or Org.com | Contact website. |
| 36 | keyword | Earth Science > Topic > Term > Variable_Level_1 | Science keywords (GCMD). |
| 37 | keyword | Location_Category > Location_Type > Location_Subregion1 | Location keywords (GCMD). |
| 38 | keyword | Short_Name > Long_Name | Platform keywords |
| 39 | keyword | Short_Name > Long_Name | Instrument keywords |
| 40 | keyword | Short_Name > Long_Name | Project keywords |
| 41 | keyword | Short_Name > Long_Name | Organization/Data Center keywords |
| 42 | otherConstraints | CITE AS STATEMENT | How to cite this data. |
| 43 | otherConstraints | OTHER CITE AS STATEMENTS (e.g. reference papers) | Additional citation info. |
| 44 | resourceConstraints | https://data.noaa.gov/docucomp/10bb305d-f440-4b92-8c1c-759dd543bc5 | Data Liicense URL Link to Docucomp Component for correct license |
| 45 | title | TITLE OF PROJECT | Title of the parent project. |
| 46 | date | 2958352.0 | Publication Date of Project |
| 47 | code | PROJECT ID | ID of the parent project. |
| 48 | title | related dataset title | Title of a related dataset. |
| 49 | date | 2958352.0 | Publication Date of the related dataset |
| 50 | code | dataset identifier | ID of a related dataset. |
| 51 | organisationName | related data organization name | Org managing related data. |
| 52 | URL | relatedDataURL | URL for related data. |
| 53 | name | related data url title | Title of the related URL. |
| 54 | description | related data description | Description of related data. |
| 55 | title | TITLE OF PUBLICATION | Title of associated paper/pub. |
| 56 | date | 2958352.0 | Publication Date of Publication |
| 57 | code | ID OF PUBLICATION | ID of associated paper/pub. |
| 58 | description | BRIEF DESCRIPTION OF EXTENT | Text description of geographic extent. |
| 59 | westBoundingLongitude | -180.0 | West Bounding Coordinates |
| 60 | eastBoundingLongitude | 180.0 | East Bounding Coordinates |
| 61 | southBoundingLatitude | -90.0 | South Bounding Coordinates |
| 62 | northBoundingLatitude | 90.0 | North Bounding Coordinates |
| 63 | beginPosition | 2958101.0 | Time period begin date |
| 64 | endPosition | 2958102.0 | Time period end date |
| 65 | day | day | Time interval unit |
| 66 | value | 99.0 | Time interval value |
| 67 | minimumValue | 99.0 | Minimum vertical extent |
| 68 | maximumValue | 99.0 | Maximum Vertical Extent |
| 69 | verticalCRS  | verticalCRSandUnits | URL Link to Vertical CRS definition. |
| 70 | supplementalInformation | any other information |  Other descriptive information about the dataset |
| 71 | MemberName | Variable Name | Name of the measured variable. |
| 72 | TypeName | String | Variable Type |
| 73 | descriptor | Platform and Instrument/Sensor Used | Platform and Instrument/Sensor Used |
| 74 | MD_Format | format name | Data format (e.g., NetCDF). |
| 75 | CI_OnlineResource | fileIdentifier | NCEI Metadata ID - same as file identifier |
| 76 | CI_OnlineResource | accessURL | Direct download URL. |
| 77 | protocol | URL type ID | Protocol (e.g., HTTPS, FTP). |
| 78 | name | name of accessURL | Name of the download link. |
| 79 | description | description of accessURL | Description of the download link. |
| 80 | MI_Instrument | INSTRUMENT_ID | Unique Instrument ID |
| 81 | type | TYPE OF INSTRUMENT | Instrument Type  |
| 82 | description | BRIEF DESCRIPTION OF INSTRUMENT | Instrument Description  |
| 83 | code | PLATFORM_ID | Unique Platform ID. |
| 84 | description | BRIEF DESCRIPTION OF PLATFORM | Platform Description. |
| 85 | code | INSTRUMENT_ID | Instrument ID mounted on platform. |
| 86 | type | TYPE OF INSTRUMENT | Instrument Type mounted on platform. |
| 87 | description | BRIEF DESCRIPTION OF INSTRUMENT | Instrument Description mounted on platform. |
