# Castmill Common UI

This package provides a set of UI components written in SolidJS that can (and should) be
used for both the Castmill Dashboard as well as any add-ons written to enhance the
dashboard functionality.

## Table sorting

`TableView` requests items sorted by `updated_at` descending by default, so the
most recently edited items appear first across dashboard and add-on tables.
Use `initialSortOptions` for tables with a specialized order, such as device
events sorted by `timestamp`. Sort options in URL parameters take precedence.
Organization and team member tables use the membership's update time; invitation
tables use the invitation's update time. Sorting is applied before pagination.

## Learn more

- Official website: https://castmill.com/
- Guides: coming soon.
- Docs: coming soon.

## License

This software is open source and is covered by the [AGPLv3 license](./LICENSE.md). If you require a different license for commercial
purposes, please get in touch with us.
