/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2026 Ser9ei
 * Inspired by service control code in luci-app-pbr by @stangri.
*/

'use strict';
'require poll';
'require rpc';
'require ui';
'require baseclass';

const callGetInitStatus = rpc.declare({
	object: 'luci.zerotier',
	method: 'getInitStatus',
	expect: { '': {} }
});
const callSetInitAction = rpc.declare({
	object: 'luci.zerotier',
	method: 'setInitAction',
	params: [ 'action' ],
	expect: { '': {} }
});

const callGetVersion = rpc.declare({
	object: 'luci.zerotier',
	method: 'getVersion',
	expect: { '': {} }
});

var status = baseclass.extend({
	getServiceStatus() {
		return callGetInitStatus().then(function(res) {
		const st = res?.zerotier || {};
		return {
				running: st.running === true,
				enabled: st.enabled === true,
				configEnabled: st.config_enabled === true
			};
		});
	},

	renderStatus(running, enabled, configEnabled) {
		const status = running ? _('Running') : _('Stopped');
		const autostart = enabled ? _('Enabled') : _('Disabled');
		let text = `${status} (${autostart})`;

		if (!configEnabled)
			text += ` - ${_('Disabled in Global configuration')}`;

		return E('span', {}, text);
	},

	pollServiceStatus(expectRunning, callback) {
		const maxAttempts = 15;
		let attempt = 0;
		const self = this;

		function checkStatus() {
			attempt++;
			self.getServiceStatus().then(function(status) {
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
	},

	render() {
		const self = this;
		const header = E('div', {}, [
				E('h2', { class: 'content' }, _('ZeroTier')),
				E('div', { class: 'cbi-map-descr' }, [
					_('ZeroTier is an open source, cross-platform and easy to use virtual LAN. For further information see '),
					E('a', {
						target: '_blank',
						rel: 'noopener noreferrer',
						href: 'https://openwrt.org/docs/guide-user/services/vpn/zerotier'
					}, _('OpenWrt ZeroTier documentation')),
					'.',
					E('br'),
					_('LuCI app project'),
					': ',
					E('a', {
						target: '_blank',
						rel: 'noopener noreferrer',
						href: 'https://github.com/Ser9ei/luci-app-zerotier'
					}, 'GitHub'),
					'.'
				])
			]);


		const section = E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Service Status'))
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

			return callSetInitAction(action)
				.then(function() {
					self.pollServiceStatus(expectedRunning, function() {
						ui.hideModal();
						self.getServiceStatus().then(updateStatus);
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
					self.getServiceStatus().then(updateStatus);
				});
		}

		function setServiceAutostart(action, message) {
			ui.showModal(null, [
				E('p', { class: 'spinning' }, message)
			]);
			return callSetInitAction(action)
				.then(function() {
					return self.getServiceStatus().then(updateStatus);
				})
				.catch(function(err) {
					ui.addNotification(null,
						E('p', {},
							_('Failed to %s ZeroTier service: %s')
								.format(action, err.message)
						),
						'error'
					);
					return self.getServiceStatus().then(updateStatus);
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
				self.renderStatus(running, enabled, configEnabled)
			);

			btnStart.disabled = running || !configEnabled;
			btnRestart.disabled = !running || !configEnabled;
			btnStop.disabled = !running;
			btnEnable.disabled = enabled && configEnabled;
			btnDisable.disabled = !enabled || !configEnabled;

			document.dispatchEvent(new CustomEvent('zerotier-status-updated'));
		}

		callGetVersion()
			.then(function(res) {
				version.lastElementChild.textContent =
					res?.version ?? _('Unknown');
			})
			.catch(function() {
				version.lastElementChild.textContent = _('Unknown');
			});

		this.getServiceStatus().then(updateStatus);

		poll.add(function() {
			return self.getServiceStatus().then(updateStatus);
		});

		return E('div', {}, [ header, section ]);
	}
});

return L.Class.extend({
	status: status
});
