/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2022 ImmortalWrt.org
 * Copyright (C) 2026 Ser9ei
 */

'use strict';
'require form';
'require poll';
'require rpc';
'require ui';
'require view';
'require tools.widgets as widgets';

const callRcList = rpc.declare({
	object: 'rc',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

const callGetVersion = rpc.declare({
	object: 'luci.zerotier',
	method: 'getVersion',
	expect: { '': {} }
});

const callGetGlobalEnabled = rpc.declare({
	object: 'luci.zerotier',
	method: 'getGlobalEnabled',
	expect: { '': {} }
});

const callSetGlobalEnabled = rpc.declare({
	object: 'luci.zerotier',
	method: 'setGlobalEnabled',
	expect: { '': {} }
});

function getServiceStatus() {
	return Promise.all([
		callRcList('zerotier'),
		callGetGlobalEnabled()
	]).then(function(res) {
		const service = res[0]?.zerotier || {};
		const global = res[1] || {};

		return {
			running: service.running === true,
			enabled: service.enabled === true,
			configEnabled: global.enabled === true
		};
	});
}

function renderStatus(running, enabled, configEnabled) {
	const status = running ? _('Running') : _('Stopped');
	const autostart = enabled ? _('Enabled') : _('Disabled');

	let text = `${status} (${autostart})`;

	if (!configEnabled)
		text += ` - ${_('Disabled in Global configuration')}`;

	return E('span', {}, text);
}

function validateAbsolutePath(section_id, value) {
	if (!value)
		return true;

	if (!value.startsWith('/'))
		return _('Path must be absolute (start with /)');

	if (value.includes('..') || value.includes('//'))
		return _('Invalid path');

	return true;
}

function pollServiceStatus(expectRunning, callback) {
	const maxAttempts = 15;
	let attempt = 0;

	function checkStatus() {
		attempt++;

		getServiceStatus().then(function(status) {
			const isRunning = status.running === true;

			if (expectRunning ? isRunning : !isRunning) {
				callback(true);
			}
			else if (attempt >= maxAttempts) {
				callback(false, 'timeout');
			}
			else {
				setTimeout(checkStatus, 1000);
			}
		}).catch(function() {
			if (attempt < maxAttempts)
				setTimeout(checkStatus, 1000);
			else
				callback(false, 'error');
		});
	}

	setTimeout(checkStatus, 1500);
}

return view.extend({
	render() {
		const m = new form.Map('zerotier', _('ZeroTier'),
			_('ZeroTier is an open source, cross-platform and easy to use virtual LAN') +
			' (' +
			'<a target="_blank" rel="noopener noreferrer" ' +
			'href="https://openwrt.org/docs/guide-user/services/vpn/zerotier">' +
			_('OpenWrt ZeroTier documentation') +
			'</a>).');

		let s, o;

		s = m.section(form.TypedSection, 'status');
		s.anonymous = true;

		s.render = function() {
			const section = E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Status'))
			]);

			const version = E('div', { class: 'cbi-value' }, [
				E('label', { class: 'cbi-value-title' }, _('Version')),
				E('div', { class: 'cbi-value-field' }, _('Collecting data…'))
			]);

			const status = E('div', { class: 'cbi-value' }, [
				E('label', { class: 'cbi-value-title' }, _('Status')),
				E('div', { class: 'cbi-value-field' }, _('Collecting data…'))
			]);

			function performServiceAction(action, expectedRunning, message) {
				ui.showModal(null, [
					E('p', {
						class: 'spinning'
					}, message)
				]);

				return callRcInit('zerotier', action)
					.then(function() {
						pollServiceStatus(expectedRunning, function() {
							ui.hideModal();
							getServiceStatus().then(updateStatus);
						});
					})
					.catch(function(err) {
						ui.hideModal();

						ui.addNotification(null,
							E('p', {},
								_('Failed to %s ZeroTier service: %s')
									.format(action, err.message)
							),
							'error'
						);

						getServiceStatus().then(updateStatus);
					});
			}

			function setServiceAutostart(action, message) {
				ui.showModal(null, [
					E('p', {
						class: 'spinning'
					}, message)
				]);

				return callRcInit('zerotier', action)
					.then(function() {
						if (action !== 'enable')
							return;

						return callGetGlobalEnabled().then(function(res) {
							if (res?.enabled !== true)
								return callSetGlobalEnabled(true);
						});
					})
					.then(function() {
						return getServiceStatus().then(updateStatus);
					})
					.catch(function(err) {
						ui.addNotification(null,
							E('p', {},
								_('Failed to %s ZeroTier service: %s')
									.format(action, err.message)
							),
							'error'
						);

						return getServiceStatus().then(updateStatus);
					})
					.finally(function() {
						ui.hideModal();
					});
			}

			const btnStart = E('button', {
				class: 'btn cbi-button cbi-button-apply',
				disabled: true,
				type: 'button',
				click: function() {
					return performServiceAction(
						'start',
						true,
						_('Starting ZeroTier service')
					);
				}
			}, _('Start'));

			const btnRestart = E('button', {
				class: 'btn cbi-button cbi-button-apply',
				disabled: true,
				type: 'button',
				click: function() {
					return performServiceAction(
						'restart',
						true,
						_('Restarting ZeroTier service')
					);
				}
			}, _('Restart'));

			const btnStop = E('button', {
				class: 'btn cbi-button cbi-button-reset',
				disabled: true,
				type: 'button',
				click: function() {
					return performServiceAction(
						'stop',
						false,
						_('Stopping ZeroTier service')
					);
				}
			}, _('Stop'));

			const btnEnable = E('button', {
				class: 'btn cbi-button cbi-button-apply',
				disabled: true,
				type: 'button',
				click: function() {
					return setServiceAutostart(
						'enable',
						_('Enabling ZeroTier service')
					);
				}
			}, _('Enable'));

			const btnDisable = E('button', {
				class: 'btn cbi-button cbi-button-reset',
				disabled: true,
				type: 'button',
				click: function() {
					return setServiceAutostart(
						'disable',
						_('Disabling ZeroTier service')
					);
				}
			}, _('Disable'));

			const btnGap = E('span', {}, '\u00a0\u00a0');
			const btnGapLong = E('span', {}, '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0');
			const buttonsTitle = E('label', {
				class: 'cbi-value-title'
			}, _('Service Control'));

			const buttonsText = E('div', {}, [
				btnStart,
				btnGap,
				btnRestart,
				btnGap,
				btnStop,
				btnGapLong,
				btnEnable,
				btnGap,
				btnDisable
			]);

			const buttonsField = E('div', {
				class: 'cbi-value-field'
			}, buttonsText);

			const buttonsRow = E('div', {
				class: 'cbi-value'
			}, [
				buttonsTitle,
				buttonsField
			]);

			section.appendChild(version);
			section.appendChild(status);
			section.appendChild(buttonsRow);

			function updateStatus(res) {
				res = res || {};

				const running = res.running === true;
				const enabled = res.enabled === true;
				const configEnabled = res.configEnabled === true;

				status.lastElementChild.replaceChildren(
					renderStatus(running, enabled, configEnabled)
				);

				btnStart.disabled = running || !configEnabled;
				btnRestart.disabled = !running || !configEnabled;
				btnStop.disabled = !running;

				btnEnable.disabled = enabled && configEnabled;
				btnDisable.disabled = !enabled || !configEnabled;
			}

			callGetVersion()
				.then(function(res) {
					version.lastElementChild.textContent =
						res?.version ?? _('Unknown');
				})
				.catch(function() {
					version.lastElementChild.textContent = _('Unknown');
				});

			getServiceStatus().then(updateStatus);

			poll.add(function() {
				return getServiceStatus().then(updateStatus);
			});

			return section;
		};

		s = m.section(form.NamedSection, 'global', 'zerotier', _('Global configuration'));

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';

		o = s.option(form.Value, 'secret', _('Client secret'));
		o.password = true;

		o = s.option(form.Value, 'local_conf_path', _('Local config path'),
			_('Path of the optional file local.conf ' +
				'(see <a target="_blank" rel="noopener noreferrer" ' +
				'href="https://docs.zerotier.com/config/#local-configuration-options">' +
				_('documentation') +
				'</a>).'));
		o.value('/etc/zerotier.conf');
		o.validate = validateAbsolutePath;

		o = s.option(form.Value, 'config_path', _('Config path'),
			_('Persistent configuration directory (to keep other configurations such as controller or moons, etc.).'));
		o.value('/etc/zerotier');
		o.validate = validateAbsolutePath;

		o = s.option(form.Flag, 'copy_config_path', _('Copy config path'),
			_('Copy the contents of the persistent configuration directory to memory instead of linking it, this avoids writing to flash.'));
		o.depends({'config_path': '', '!reverse': true});

		o = s.option(form.Flag, 'fw_allow_input', _('Allow input traffic'),
			_('Allow input traffic to the ZeroTier daemon.'));

		o = s.option(form.Button, '_panel', _('ZeroTier Central'),
			_('Create or manage your ZeroTier network and authorize clients.'));
		o.inputtitle = _('Open website');
		o.inputstyle = 'apply';
		o.onclick = function() {
			window.open('https://my.zerotier.com/network', '_blank', 'noopener,noreferrer');
		};

		s = m.section(form.GridSection, 'network', _('Network configuration'));
		s.addremove = true;
		s.rowcolors = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'id', _('Network ID'),
			_('16 hexadecimal characters.'));
		o.rmempty = false;
		o.width = '20%';
		o.maxlength = 16;
		o.validate = function(section_id, value) {
			if (!/^[0-9a-fA-F]{16}$/.test(value))
				return _('Must be exactly 16 hexadecimal characters.');
			return true;
		};

		o = s.option(form.Flag, 'allow_managed', _('Allow managed IP/route'),
			_('Allow ZeroTier to set IP addresses and routes (local/private ranges only).'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Flag, 'allow_global', _('Allow global IP/route'),
			_('Allow ZeroTier to set global/public/non-private IP addresses and routes.'));
		o.editable = true;

		o = s.option(form.Flag, 'allow_default', _('Allow default route'),
			_('Allow ZeroTier to set the default route on the system.'));
		o.editable = true;

		o = s.option(form.Flag, 'allow_dns', _('Allow DNS'),
			_('Allow ZeroTier to set DNS servers.'));
		o.editable = true;

		o = s.option(form.Flag, 'fw_allow_input', _('Allow input'),
			_('Allow input traffic from the ZeroTier network.'));
		o.editable = true;

		o = s.option(form.Flag, 'fw_allow_forward', _('Allow forward'),
			_('Allow forward traffic from/to the ZeroTier network.'));
		o.editable = true;

		o = s.option(widgets.DeviceSelect, 'fw_forward_ifaces', _('Forward interfaces'),
			_('Leave empty for all.'));
		o.multiple = true;
		o.noaliases = true;
		o.depends('fw_allow_forward', '1');
		o.modalonly = true;

		o = s.option(form.Flag, 'fw_allow_masq', _('Masquerading'),
			_('Enable network address and port translation (NAT) for outbound traffic for this network.'));
		o.editable = true;

		o = s.option(widgets.DeviceSelect, 'fw_masq_ifaces', _('Masquerade interfaces'),
			_('Leave empty for all.'));
		o.multiple = true;
		o.noaliases = true;
		o.depends('fw_allow_masq', '1');
		o.modalonly = true;

		return m.render();
	}
});
