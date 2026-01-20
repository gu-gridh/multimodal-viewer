const express = require('express');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });
const app = express();
const projectName = process.env.PROJECT || 'default';

const configPath = path.join(__dirname, 'viewer', 'projects', projectName, 'config.json');
let config;
try {
  config = require(configPath);
} catch (error) {
  console.error(`Failed to load config for project ${projectName}:`, error);
  process.exit(1);
}

app.get('/viewer/modules/rti/rti.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  //fetch RTI image data from the API
  const apiUrl = `${config.panel}${queryName}`;

  try {
    const apiResponse = await axios.get(apiUrl);
    const rtiImages = apiResponse.data?.features?.[0]?.properties?.attached_RTI || [];

    if (Array.isArray(rtiImages) && rtiImages.length > 0) {
      rtiImages.sort((a, b) => {
        const numA = parseInt(a.title?.match(/\d+/)?.[0] || 0, 10);
        const numB = parseInt(b.title?.match(/\d+/)?.[0] || 0, 10);
        return numA - numB;
      });
    }

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'rti', 'rti.html'), 'utf8', (err, htmlData) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }
      const initialRTIUrl = rtiImages.length > 0 ? rtiImages[0].url : '';

      const dropdownHtml = rtiImages.map(rti => {
        const dl = rti.url_for_download || '';
        const downloadable = rti.is_downloadable && !!dl;
        return `<option
                  value="${rti.url}"
                  data-downloadable="${downloadable ? '1' : '0'}"
                  data-dl-url="${dl}">
                  ${rti.title}
                </option>`;
      }).join('');

      let modifiedHtml = htmlData.replace("PLACEHOLDER_RTI", initialRTIUrl);
      modifiedHtml = modifiedHtml.replace('<!-- PLACEHOLDER_FOR_BUTTONS -->',
        `<select id="rtiImageDropdown" onchange="updateRTIImage(this.value)">
          ${dropdownHtml}
        </select>`);
      res.send(modifiedHtml);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/pointcloud/pointcloud.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const position = apiResponse.data?.features?.[0]?.properties?.spatial_position;
    const direction = apiResponse.data?.features?.[0]?.properties?.spatial_direction;

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'pointcloud', 'pointcloud.html'), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }
      let modifiedData = data;
      const positionStr = position ? position.join(',') : '';
      const directionStr = direction ? direction.join(',') : '';

      modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, `${config.pointcloud}`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_POSITION'/g, `[${positionStr}]`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_DIRECTION'/g, `[${directionStr}]`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_DISPLAY_ANNOTATIONS'/g, config.displayAnnotations);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_POINTCLOUD_ANNOTATIONS'/g, `'${config.pointcoudAnnotations}'`);
      res.send(modifiedData);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/iiif/iiif.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  const queryType = fullQuery ? fullQuery.split('/')[1] : '';

  if (!queryName || !queryType) {
    return res.status(400).send('Query parameter is missing or incorrect');
  }

  const apiUrl = `${config.panel}${queryName}`;

  try {
    const apiResponse = await axios.get(apiUrl);
    const modelData = apiResponse.data.features;

    if (!modelData || modelData.length === 0) {
      return res.status(404).send('<div style="height:100%;width:100%;padding-top:45%;text-align:center;color:white;font-weight:100;font-size: 1.3em;font-family:sans-serif;">No data available yet<br>Ще немає даних</div>');
    }

    if (queryType === 'orthophoto') {
      if (modelData?.[0]?.properties?.attached_photograph?.length) {
        const htmlContent = fs.readFileSync(path.join(__dirname, 'viewer', 'modules', 'iiif', 'iiif.html'), 'utf8');
        const sequenceEnabled = false;
        const displayStyle = sequenceEnabled ? 'flex' : 'none';
        const basePath = `${config.basePath}`;
        const basePathDownload = `${config.downloadPath}`;
        const iiifFilePath = modelData?.[0]?.properties?.attached_photograph?.[0]?.iiif_file;
        const downloadFile = modelData?.[0]?.properties?.attached_photograph?.[0]?.file;
        const annotationPath = `${config.annotationPath}`;
        const fullPath = `"${basePath}${iiifFilePath}/info.json"`;
        const downloadFilePath = `"${basePathDownload}${downloadFile}"`;
        let updatedHtmlContent = htmlContent
          .replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, fullPath || '')
          .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify(downloadFilePath))
          .replace(/'PLACEHOLDER_ANNOTATION_PATH'/g, JSON.stringify(`${annotationPath}${queryName}`))
          .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(`${config.inscriptionUrl}`))
          .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations)
          .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations ? 'flex' : 'none')
          .replace(/'PLACEHOLDER_SEQUENCE_SHOW'/g, displayStyle)
          .replace(/'PLACEHOLDER_SEQUENCE_ENABLE'/g, sequenceEnabled)
          .replace('PLACEHOLDER_PROJECT', JSON.stringify(config.project));
        res.send(updatedHtmlContent);
      } else {
        res.send('No attached photographs found.');
      }
    } else if (queryType === 'topography') {
      if (modelData?.[0]?.properties?.attached_topography?.length) {
        const htmlContent = fs.readFileSync(path.join(__dirname, 'viewer', 'modules', 'iiif', 'iiif.html'), 'utf8');
        const sequenceEnabled = true;
        const displayStyle = sequenceEnabled ? 'flex' : 'none';
        const basePathIiif = `${config.basePath}`;
        const basePathDownload = `${config.downloadPath}`;
        const annotationPath = `${config.annotationPath}`;

        //sort the attached_topography array based on the file name
        const sortedTopography = (modelData?.[0]?.properties?.attached_topography || []).sort((a, b) => {
          const order = ['blended', 'texture', 'normal'];
          const getOrder = (file) => {
            return order.findIndex(keyword => file.includes(keyword));
          };
          return getOrder(a.file) - getOrder(b.file);
        });

        const topographyImagesIiif = sortedTopography.map(topography => `${basePathIiif}${topography.iiif_file}/info.json`);
        const topographyImagesJpg = sortedTopography.map(topography => `${basePathDownload}${topography.file}`);

        let updatedHtmlContent = htmlContent
          .replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, JSON.stringify(topographyImagesIiif))
          .replace('PLACEHOLDER_DOWNLOAD_PATH', JSON.stringify(topographyImagesJpg))
          .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations ? 'flex' : 'none')
          .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(`${config.inscriptionUrl}`))
          .replace(/'PLACEHOLDER_ANNOTATION_PATH'/g, JSON.stringify(`${annotationPath}${queryName}`))
          .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations)
          .replace(/'PLACEHOLDER_SEQUENCE_SHOW'/g, displayStyle)
          .replace(/'PLACEHOLDER_SEQUENCE_ENABLE'/g, sequenceEnabled)
          .replace('PLACEHOLDER_PROJECT', JSON.stringify(config.project));
        res.send(updatedHtmlContent);
      } else {
        res.send('No attached topography images found.');
      }
    } else {
      res.status(400).send('Invalid type specified in query');
    }
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/projects/:projectName/metadata/metadata.html', async (req, res) => {
  const { projectName } = req.params;
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  const annotationId = req.query.annotationId || null;
  const currentLang = req.query.lang || 'en';

  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `${config.metadata}${queryName}&depth=1`;
  const metadataPath = path.join(__dirname, 'viewer', 'projects', projectName, 'metadata', 'metadata.html');

  try {
    //fetch panel metadata
    const metadataPromise = axios.get(apiUrl);

    //read the HTML template
    const htmlDataPromise = fs.promises.readFile(metadataPath, 'utf8');

    //fetch inscription data if annotationId is provided
    let inscriptionPromise = Promise.resolve(null);
    if (annotationId) {
      const inscriptionApiUrl = `https://saintsophia.dh.gu.se/api/inscriptions/inscription/${annotationId}?depth=2`;
      inscriptionPromise = axios.get(inscriptionApiUrl);
    }

    //wait for all promises to resolve...
    const [apiResponse, htmlData, inscriptionResponse] = await Promise.all([
      metadataPromise,
      htmlDataPromise,
      inscriptionPromise
    ]);

    //validate panel metadata response
    if (!apiResponse || !apiResponse.data || !apiResponse.data.results) {
      return res.status(404).send('Missing data');
    }
    const metadata = apiResponse.data.results[0];
    if (!metadata) {
      return res.status(404).send('');       
    }

    //load HTML template using Cheerio
    const $ = cheerio.load(htmlData);
    let dataAvailable = false;
    let epidocText = '';

    //function to set or remove metadata fields in the HTML
    function setOrRemoveField(selector, value) {
      if (!value) {
        $(selector).closest('.metadata-item').remove();
      } else {
        $(selector).html(value);
      }
    }

    //hide metadata descriptions when type is pictorial graffiti
    function setOrRemoveDescription(selector, value) {
      if (!value) {
        const $description = $(selector).closest('.metadata-description');
        const $columnsContainer = $description.closest('.metadata-columns');

        $description.remove();

        //if the columns container has no more metadata-description elements, remove it
        if ($columnsContainer.find('.metadata-description').length === 0) {
          $columnsContainer.remove();
        }
      } else {
        $(selector).html(value);
      }
    }

    //change font if cyrillic
    function updateFontClass(selector, isCyrillic) {
      const $element = $(selector);
      if ($element.length) {
        $element.removeClass('ancient-cyrillic modern-font');
        if (isCyrillic) {
          $element.addClass('ancient-cyrillic');
        } else {
          $element.addClass('modern-font');
        }
      }
    }

    //populate panel metadata
    const panelTitle = currentLang === 'uk' ? 'Поверхня' : 'Surface';
    const panelDocumentation = currentLang === 'uk'
      ? (metadata.documentation || []).map(d => d?.text_ukr).join(' ')
      : (metadata.documentation || []).map(d => d?.observation).join(' ');
    const panelMedium = currentLang === 'uk'
      ? metadata.medium?.text_ukr ?? 'Unknown'
      : metadata.medium?.text ?? 'Unknown';
    const panelMaterial = currentLang === 'uk'
      ? metadata.material?.text_ukr ?? 'Unknown'
      : metadata.material?.text ?? 'Unknown';

    $('#panel-title').html(`${panelTitle} ${metadata.title ?? 'Unknown'}`);
    $('#panel-inscriptions').html(metadata.number_of_inscriptions ?? 'Unknown');
    $('#panel-languages').html(metadata.number_of_languages ?? 'Unknown');
    $('#panel-documentation').html(panelDocumentation);
    $('#panel-medium').html(panelMedium ?? 'Unknown');
    $('#panel-material').html(panelMaterial ?? 'Unknown');

    //populate inscription data if available
    if (annotationId && inscriptionResponse && inscriptionResponse.data) {
      const data = inscriptionResponse.data;
      dataAvailable = true;
      epidocText = data.epidoc_text || '';

      //title
      const title = data.panel && data.panel.title ? data.panel.title : "Unknown Panel";
      const inscriptionTitle = data.title ? `(${data.title})` : "";
      const titlePrefix = currentLang === 'uk' ? 'Hапис' : 'Inscription';
      const fullTitle = `${titlePrefix} ${title}:${annotationId} ${inscriptionTitle}`;

      //metadata fields
      const isPictorialGraffiti = data.type_of_inscription?.id === 2;

      const typeText = data.type_of_inscription
        ? (currentLang === 'uk' && data.type_of_inscription.text_ukr
          ? data.type_of_inscription.text_ukr
          : data.type_of_inscription.text)
        : "Unknown";

      const interpretation = !isPictorialGraffiti
        ? (data.interpretative_edition || (currentLang === 'uk'
          ? "<p class='modern-font'>транскрипція недоступна</p>"
          : "<p class='modern-font'>Interpretation not available</p>"))
        : null;

      const romanisation = (!isPictorialGraffiti && data.romanisation)
        ? data.romanisation
        : (!isPictorialGraffiti
          ? (currentLang === 'uk'
            ? "<p>транскрипція недоступна</p>"
            : "<p>Romanisation not available</p>")
          : null);

      const diplomatic = !isPictorialGraffiti
        ? (data.transcription || (currentLang === 'uk'
          ? "<p class='modern-font'>транскрипція недоступна</p>"
          : "<p class='modern-font'>Textual graffiti not available</p>"))
        : null;

      const translation = !isPictorialGraffiti
        ? (currentLang === 'uk'
          ? (data.translation_ukr || "<p>Переклад недоступний</p>")
          : (data.translation_eng || "<p>Translation not available</p>"))
        : null;

      const writing = data.writing_system
        ? (currentLang === 'uk' && data.writing_system.text_ukr
          ? data.writing_system.text_ukr
          : data.writing_system.text)
        : "";

      const isCyrillic = data.writing_system && (
        data.writing_system.text === 'Cyrillic' || data.writing_system.text_ukr === 'Кирилиця'
      );

      const language = data.language
        ? (currentLang === 'uk' && data.language.text_ukr
          ? data.language.text_ukr
          : data.language.text)
        : "";

      const genre = data.genre && data.genre.length > 0
        ? (currentLang === 'uk' && data.genre[0].text_ukr
          ? data.genre[0].text_ukr
          : data.genre[0].text)
        : "";

      const tags = data.tags && data.tags.length > 0
        ? data.tags.map(tag =>
          currentLang === 'uk' && tag.text_ukr ? tag.text_ukr : tag.text
        ).join(', ')
        : "";

      const elevation = data.elevation !== null
        ? `${data.elevation}`
        : (currentLang === 'uk' ? "" : "");

      const comments = currentLang === 'uk'
        ? (data.comments_ukr || "<p>коментар недоступний</p>")
        : (data.comments_eng || "<p>Comment not available</p>");

      const inscriber = data.inscriber
        ? `${data.inscriber.firstname} ${data.inscriber.lastname}`
        : "";

      const editlink = `https://saintsophia.dh.gu.se/admin/inscriptions/inscription/${annotationId}/change/`;

      //KORNIENKO GALLERY
      const korniienko = Array.isArray(data.korniienko_image)
        ? data.korniienko_image.filter(i => i.published)
        : [];

      const authorMap = {};
      if (Array.isArray(data.author)) {
        data.author.forEach(a => {
          authorMap[a.id] = `${a.lastname}`;
        });
      }

      if (korniienko.length) {
        korniienko.sort((a, b) => {
          const ta = (a.type_of_image || '').toLowerCase();
          const tb = (b.type_of_image || '').toLowerCase();
          return tb.localeCompare(ta, undefined, { sensitivity: 'base' }); //reverse alphabetical
        });

        const $template = $('#korniienko-gallery .korniienko-card.template');
        const n = v => (v === null || v === undefined || v === '') ? '—' : v;

        korniienko.forEach(img => {
          const $card = $template.clone().removeClass('template');

          //thumbnail
          $card.find('.kor-link').attr('href', img.url);
          $card.find('.korniienko-thumb')
            .attr('src', img.url)
            .attr('alt', img.title || 'Korniienko image');

          const authorName = authorMap[img.author] || '—';
          $card.find('.kor-line1').text(`${authorName} ${n(img.year)}, plate ${n(img.plate)}`);
          const imgTypeText = (() => { //hardcode image types for ukrainian
            if (currentLang === 'uk') {
              if (img.type_of_image === 'Drawing')    return 'Малюнок';
              if (img.type_of_image === 'Photograph') return 'Фотографія';
            }
            return n(img.type_of_image);
          })();
          $card.find('.kor-line2').text(imgTypeText);
          $card.find('.kor-line3').text(`${n(img.type_of_license)}`);
          $('#korniienko-gallery').append($card);
        });

        $template.remove();
      } else {
        $('#korniienko-gallery').remove();
        $('#gallery-title-container').remove();
      }

      //dimensions
      const width = data.width ? data.width : "";
      const height = data.height ? data.height : "";
      const dimensions = width && height
        ? `${width} x ${height}`
        : (currentLang === 'uk' ? "" : "");

      //year range
      const minYear = data.min_year !== null ? data.min_year : '';
      const maxYear = data.max_year !== null ? data.max_year : '';
      const yearRange = minYear && maxYear ? `${minYear} - ${maxYear}` : '';

      //conditions
      const conditions = (data.condition && data.condition.length > 0)
        ? data.condition.map(cond =>
          currentLang === 'uk' ? (cond.text_ukr || '') : (cond.text || '')
        ).filter(Boolean).join(', ')
        : (currentLang === 'uk' ? "Умови недоступні" : "Condition not available");

      //alignment
      const alignment = (data.alignment && data.alignment.length > 0)
        ? data.alignment.map(align =>
          currentLang === 'uk' ? (align.text_ukr || '') : (align.text || '')
        ).filter(Boolean).join(', ')
        : (currentLang === 'uk' ? "" : "");

      //alphabetical signs
      const alphabeticalSigns = (data.extra_alphabetical_sign && data.extra_alphabetical_sign.length > 0)
        ? data.extra_alphabetical_sign.map(sign =>
          currentLang === 'uk' ? (sign.text_ukr || '') : (sign.text || '')
        ).filter(Boolean).join(', ')
        : (currentLang === 'uk' ? "" : "");

      //dating criteria
      const datingCriteria = (data.dating_criteria && data.dating_criteria.length > 0)
        ? data.dating_criteria.map(dating =>
          currentLang === 'uk' ? (dating.text_ukr || '') : (dating.text || '')
        ).filter(Boolean).join(', ')
        : (currentLang === 'uk' ? "" : "");

      //contributors
      const contributors = (data.author && data.author.length > 0)
        ? data.author.map(contributor => {
          const name = currentLang === 'uk'
            ? ((contributor.firstname_ukr || '') + ' ' + (contributor.lastname_ukr || '')).trim()
            : ((contributor.firstname || '') + ' ' + (contributor.lastname || '')).trim();
          return name || null;
        }).filter(Boolean).join(', ')
        : (currentLang === 'uk' ? "" : "");

      //bibliography
      const bibliographyEntries = (data.bibliography && data.bibliography.length > 0)
        ? data.bibliography.map(entry => {
          //format: authors (year). title. body of Publication.
          const authors = entry.authors || "Unknown Author";
          const year = entry.year || "n.d.";
          const title = entry.title || "Untitled";
          const body = entry.body_of_publication || "Unpublished";
          return `${authors} (${year}). <em>${title}</em>. ${body}.`;
        }).join('<br>')
        : (currentLang === 'uk' ? "" : "");
      if (!bibliographyEntries) {
        $('#inscription-bibliography').closest('.metadata-description').remove();
      } else {
        $('#inscription-bibliography').html(bibliographyEntries);
      }

      //mentioned people
      const mentionedPersons = data.mentioned_person && data.mentioned_person.length > 0
        ? (currentLang === 'uk'
          ? data.mentioned_person.map(person => person.name_ukr || '').filter(Boolean).join(', ')
          : data.mentioned_person.map(person => person.name || '').filter(Boolean).join(', '))
        : "";

      $('#inscription-title').html(fullTitle);
      $('#inscription-condition').html(conditions);
      $('#inscription-contributors').html(contributors);
      $('#inscription-alignment').html(alignment);
      $('#inscription-comment').html(comments);
      $('#inscription-type').html(typeText);
      $('#edit-link').attr('href', editlink);

      setOrRemoveDescription('#inscription-interpretation', interpretation);
      setOrRemoveDescription('#inscription-romanisation', romanisation);
      setOrRemoveDescription('#inscription-diplomatic', diplomatic);
      setOrRemoveDescription('#inscription-translation', translation);
      updateFontClass('#inscription-diplomatic', isCyrillic);
      updateFontClass('#inscription-interpretation', isCyrillic);
      setOrRemoveField('#inscription-alignment', alignment);
      setOrRemoveField('#inscription-language', language);
      setOrRemoveField('#inscription-genre', genre);
      setOrRemoveField('#inscription-tags', tags);
      setOrRemoveField('#inscription-writing', writing);
      setOrRemoveField('#inscription-mentioned-persons', mentionedPersons);
      setOrRemoveField('#inscription-inscriber', inscriber);
      setOrRemoveField('#inscription-dating-criteria', datingCriteria);
      setOrRemoveField('#inscription-alphabetical', alphabeticalSigns);
      setOrRemoveField('#inscription-dimension', dimensions);
      setOrRemoveField('#inscription-year-range', yearRange);
      setOrRemoveField('#inscription-elevation', elevation);
    }

    //handle when inscription data is not available
    if (!dataAvailable) {
      $('.metadata-inscription').remove();
    } else {
      $('.metadata-help').css('display', 'none');
    }

    $('#epidoc-rendering').attr('data-epidoc-text', encodeURIComponent(epidocText || ''));

    res.send($.html());
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/mesh/mesh.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  if (!queryName) { 
    return res.status(400).send('Query parameter is missing');
  }

  try {
    const { data } = await axios.get(`${config.panel}${queryName}`);
    const mesh = data.features?.[0]?.properties?.attached_3Dmesh?.[0] || {};
    const isDownloadable = mesh.is_downloadable && mesh.url_for_download;

    fs.readFile(
      path.join(__dirname, 'viewer', 'modules', 'mesh', 'mesh.html'),
      'utf8',
      (err, html) => {
        if (err) return res.status(500).send('Internal server error');

        let modified = html
          .replace(/PLACEHOLDER_MESH/g, JSON.stringify(mesh.url || ''))
          .replace(/PLACEHOLDER_SECOND_MESH/g, JSON.stringify(''))
          .replace(/PLACEHOLDER_STARTPHI/g, JSON.stringify(0.0))
          .replace(/PLACEHOLDER_STARTTHETA/g, JSON.stringify(0.0))
          .replace(/PLACEHOLDER_STARTDISTANCE/g, JSON.stringify(1.5))
          .replace(/PLACEHOLDER_STARTPAN/g, JSON.stringify([0.0, 0.0, 0.0]))
          .replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify([-180.0, 180.0]))
          .replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify([-180.0, 180.0]))
          .replace(/PLACEHOLDER_TRACKBALLSTART/g, JSON.stringify([0.0, 0.0, 0.0, 0.0, 0.0, 1.5]));
        const $ = cheerio.load(modified);

        if (isDownloadable) {
          $('#download').attr('href', mesh.url_for_download);
          $('#download .download-button').removeClass('deactivated');
        } else {
          $('#download').removeAttr('href');
          $('#download .download-button').addClass('deactivated');
        }

        res.send($.html());
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal server error');
  }
});

app.use('/viewer/modules/mesh', express.static(path.join(__dirname, 'viewer', 'modules', 'mesh')));
app.use('/viewer/modules/pointcloud', express.static(path.join(__dirname, 'viewer', 'modules', 'pointcloud')));
app.use('/viewer/modules/rti', express.static(path.join(__dirname, 'viewer', 'modules', 'rti')));
app.use('/viewer/modules/iiif', express.static(path.join(__dirname, 'viewer', 'modules', 'iiif')));
app.use('/viewer/shared', express.static(path.join(__dirname, 'viewer', 'shared')));
app.use('/viewer/projects', express.static(path.join(__dirname, 'viewer', 'projects')));
app.use('/viewer/locales', express.static(path.join(__dirname, 'viewer', 'locales')));
app.use('/viewer/libs', express.static(path.join(__dirname, 'viewer', 'libs')));

//Fallback route, serve index.html
app.get('*', async (req, res) => {
  const queryName = req.query.q;
  const queryId = queryName ? queryName.split('/')[0] : '';

  if (!queryName) {
    const indexPath = path.join(__dirname, 'index.html');
    return res.sendFile(indexPath);
  }

  const projectPath = path.join(__dirname, 'viewer', 'projects', projectName);
  const indexPath = path.join(projectPath, 'index.html');
  const envPath = path.join(projectPath, '.env');

  let matomoUrl = '';
  let matomoId = '';

  if (fs.existsSync(envPath)) {
    const projectEnv = dotenv.parse(fs.readFileSync(envPath));
    matomoUrl = projectEnv.MATOMO_URL || '';
    matomoId = projectEnv.MATOMO_ID || '';
  } else {
    console.warn(`.env file not found at ${envPath}`);
  }

  try {
    const apiUrl = `${config.panel}${queryId}`;
    const apiResponse = await axios.get(apiUrl);
    const rtiImages = apiResponse.data?.features?.[0]?.properties?.attached_RTI || [];

    fs.readFile(indexPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the index.html file:', err);
        return res.status(500).send('Internal Server Error');
      }

      let modifiedData = data
        .replace(/PLACEHOLDER_QUERY/g, queryName)
        .replace(/PLACEHOLDER_ID/g, queryId)
        .replace('PLACEHOLDER_BACKBUTTON', config.backButton)
        .replace(/MATOMO_URL_PLACEHOLDER/g, matomoUrl)
        .replace(/MATOMO_ID_PLACEHOLDER/g, matomoId);

      //if there are no RTI images, remove the RTI tab
      if (rtiImages.length === 0) {
        modifiedData = modifiedData.replace(
          /<div class="ui-module-item left" id="btn4" title="Explore RTI documentation"[^>]*>\s*<\/div>/,
          ''
        );
      }
      res.send(modifiedData);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return res.status(500).send('Internal Server Error');
  }
});

const PORT = 8095;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
