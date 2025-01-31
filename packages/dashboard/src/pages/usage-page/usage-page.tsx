import styles from './usage-page.module.scss';

import { Component, createSignal, For, onMount } from 'solid-js';
import { UsageService } from '../../services/usage';
import { store } from '../../store/store';
import { Usage } from '../../interfaces/usage';
import { UsageComponent } from '../../components/usage/usage';

const [usage, setUsage] = createSignal<Usage>();

/**
 * UsagePage component.
 */
const UsagePage: Component = () => {
  onMount(async () => {
    const organizationId = store.organizations.selectedId;
    if (organizationId) {
      try {
        const usage = await UsageService.getUsage(organizationId);
        console.log({ usage });
        setUsage(usage);
      } catch (error) {
        alert(`Failed to fetch usage data ${error}`);
      }
    }
  });

  return (
    <div class={styles.castmillUsage}>
      <div class={styles.wrapper}>
        <h1>Usage</h1>
        <UsageComponent used={10} total={100} />
        <div class="p-4 bg-white rounded shadow-md">
          <h2 class="text-xl font-bold mb-4">Resource Usage</h2>
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="py-2">Resource</th>
                <th class="py-2">Used / Total</th>
                <th class="py-2">Progress</th>
              </tr>
            </thead>
            <tbody>
              <For each={Object.entries(usage() || {})}>
                {([resource, { used, total }]) => {
                  const percentage = total > 0 ? (used / total) * 100 : 0;

                  return (
                    <tr class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="py-2 font-medium capitalize">{resource}</td>
                      <td class="py-2">
                        {used} / {total}
                      </td>
                      <td class="py-2">
                        <div class="w-full bg-gray-200 rounded h-4 relative overflow-hidden">
                          <div
                            class="bg-blue-500 h-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsagePage;
