/**
 * AddOn Interface.
 *
 * AddOns are the plugins that can be added to the application. Most functionality in
 * Castmill is provided by AddOns.
 *
 */
export interface AddOn {
  /**
   * The unique identifier of the AddOn.
   */
  id: string;

  /**
   * The name of the AddOn.
   */
  name: string;

  /**
   * The description of the AddOn.
   */
  description: string;

  /**
   * The version of the AddOn.
   */
  version: string;

  /**
   * The author of the AddOn.
   */
  author: string;

  /**
   * The license of the AddOn.
   */
  license: string;

  /**
   * The path of the AddOn, or where we can find the root component
   * of the Addon.
   */
  path: string;

  /**
   * Where to mount the AddOn in the application.
   * A KeyPath is a period separated string that represents the path to the AddOn.
   * For example, if the KeyPath is "admin.settings", the AddOn will be mounted at
   * /admin/settings.
   */
  mount_point: string;

  /**
   * Mount path of the AddOn.
   * Where on the application's router path, the addon will be mounted
   * (if any).
   */
  mount_path?: string;

  /**
   * The icon of the AddOn.
   */
  icon: string;

  /**
   * The endpoint of the AddOn, is the URL where the server side logic required by
   * the addon is located.
   * It may be possible that the AddOn does not require a server side logic, other than
   * the one provided by the Castmill API. In that case, the endpoint should be left
   * empty.
   * Note that authentication is required to access the endpoint using delegation tokens.
   */
  endpoint?: string;

  /**
   * The components of the AddOn.
   * An AddOn is a SolidJS component that is lazily loaded when the AddOn is mounted.
   */
  component: string;
}
