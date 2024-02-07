/**
 * Template allows the creation of templates that can be used to create
 * Menuboards, Real Estate Boards, Ad boards, etc. etc.
 *
 */

/**
 * A template is precisely defined by a data model and a design.
 *
 * The data model is needed in order to be able to populate anything
 * meaningful inside the template. Default values can be useful here.
 * Support for nesting will be mandatory.
 *
 * Challenges: how to format data? Dates, money are usually the most
 * common. built utility functions? a format language for strings a la printf?
 * What about conditionals? some parts of the template may only be shown
 * if some data is true. In some cases it can be "switch-case" kind of
 * conditionals.
 *
 * Styling, free CSS or Tailwind CSS?
 *
 * Animations and other effects?
 *
 * How to fetch data? How to define a given data entity (for example one estateId)?
 * And how to retrieve this data, with authentication/authorisation, and more.
 *
 * Allow using other widgets inside a template? for example, an image slider widget
 * could be used inside a template. Is a Playlist a widget? can we use playlists as
 * widgets inside templates? that would be really powerful. And Layouts?
 * And what about using a template inside another template? Composition of templates?
 *
 * It would then be possible to do something like the TPD widget as composition of templates
 * first create one template for one agency, then another template that uses a playlist
 * of templates based on how many estates we have.
 *
 * Concept of Boxes? thats like a div actually with some styling. Boxes would
 * be the most common way to structure a template. Inside a box you can have more
 * boxes, lists, etc.
 *
 * A small palette of primitives:
 * - Box
 * - List
 * - SingleLineText (auto scalable)
 * - MultiLineText (auto scalable)
 * - Tuple (for example, label and value)
 * - Image
 * - QRCode
 * - Image slider (maybe more generic, an actual playlist inside the template?)
 * - Template (a nested template)
 *
 */
const JsonSchema = {
  meta: {
    name: 'My Template',
    version: '1.0.0',
    description: 'My Template',
    aspectRatio: '16:9',
    fonts: [],
    medias: [],
  },
  model: {
    settings: {
      numObjects: 'number',
      numImages: 'number',
      imageDuration: 'number',
    },
    estate: {
      id: 'string',
      name: 'string',
      address: 'string',
      price: 'number',
      area: 'number',
      rooms: 'number',
      bathrooms: 'number',
      bedrooms: 'number',
      garage: 'number',
      garden: 'number',
      balcony: 'number',
      terrace: 'number',
      elevator: 'number',
      parking: 'number',
      furnished: 'number',
      heating: 'number',
      cooling: 'number',
      heatingType: 'string',
      images: ['string'],
    },
  },
  design: {
    background: {}, // Margin, padding, color, etc.
    items: [],
  },
}
