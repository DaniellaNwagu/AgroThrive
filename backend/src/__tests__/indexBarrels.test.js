describe('index barrels', () => {
  it('exports the model modules', () => {
    expect(require('../models').WaitlistEntry).toBe(require('../models/WaitlistEntry'));
  });

  it('exports the service modules', () => {
    expect(require('../services').WaitlistService).toBe(require('../services/WaitlistService'));
    expect(require('../services').AutomaticOrderProcessor).toBe(require('../services/AutomaticOrderProcessor'));
  });
});
