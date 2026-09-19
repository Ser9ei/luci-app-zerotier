/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2022 ImmortalWrt.org
 * Copyright (C) 2026 Ser9ei
 */

'use strict';
'require rpc';
'require ui';
'require view';

function formatBytes(bytes) {
	if (bytes === null || bytes === undefined || bytes === '')
		return '0 B';

	const value = Number(bytes);

	if (!Number.isFinite(value))
		return '0 B';

	const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB' ];
	let unit = 0;
	let size = value;

	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024;
		unit++;
	}

	return unit === 0
		? `${Math.round(size)} B`
		: `${size.toFixed(1)} ${units[unit]}`;
}

const callGetInterfaces = rpc.declare({
	object: 'luci.zerotier',
	method: 'getInterfaces',
	expect: {
		'': {}
	}
});

return view.extend({
	load() {
		return callGetInterfaces().then(function(res) {
			res = res || {};

			const zerotier = res.zerotier || {};
			const interfaces = zerotier.interfaces || [];

			if (!Array.isArray(interfaces))
				return [];

			return interfaces.map(function(interfaceData) {
				return {
					network_id: interfaceData.network_id,
					name: interfaceData.name,
					type: interfaceData.type,
					status: interfaceData.status,
					device_name: interfaceData.device_name,
					mac: interfaceData.mac,
					ip_address: interfaceData.ip_address,
					mtu: interfaceData.mtu,
					rx_bytes: interfaceData.rx_bytes,
					tx_bytes: interfaceData.tx_bytes
				};
			});
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Unable to get interface info: %s.').format(err.message)));
			return [];
		});
	},

	render(data) {
		const title = E('h2', {class: 'content'}, _('ZeroTier'));
		const desc = E('div', {class: 'cbi-map-descr'}, 
			[_('ZeroTier is an open source, cross-platform and easy to use virtual LAN'),
			' (',
			E('a', {
				target: '_blank',
				rel: 'noopener noreferrer',
				href: 'https://openwrt.org/docs/guide-user/services/vpn/zerotier'
			}, _('OpenWrt ZeroTier documentation')),
			').'
		]);

		if (!Array.isArray(data) || data.length === 0) {
			return E('div', {}, [title, desc, E('div', {}, _('No interface online.'))]);
		}

		const tables = data.map(function(interfaceData, index) {
			const rows = [
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('Network Name')),
					E('td', {class: 'td left'}, interfaceData.name)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('Network ID')),
					E('td', {class: 'td left'}, interfaceData.network_id)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('Network Device')),
					E('td', {class: 'td left'}, interfaceData.device_name)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('Type')),
					E('td', {class: 'td left'}, interfaceData.type)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('Status')),
					E('td', {class: 'td left'}, interfaceData.status)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('MAC Address')),
					E('td', {class: 'td left'}, interfaceData.mac)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('IP Address')),
					E('td', {class: 'td left'}, interfaceData.ip_address)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('MTU')),
					E('td', {class: 'td left'}, interfaceData.mtu)
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('Received')),
					E('td', {class: 'td left'}, formatBytes(interfaceData.rx_bytes))
				]),
				E('tr', {class: 'tr'}, [
					E('th', {class: 'th left'}, _('Sent')),
					E('td', {class: 'td left'}, formatBytes(interfaceData.tx_bytes))
				])
			];

			return E('table', {class: 'table', style: index > 0 ? 'margin-top: 1em' : null}, rows);
		});

		return E('div', {}, [title,desc,E('div', {class: 'cbi-section'}, [E('h3', {}, _('Network Interface Information')), ...tables])]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
