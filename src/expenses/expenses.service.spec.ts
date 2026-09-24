import { unrestrictedBranchVisibilityMock } from '../branch-visibility/testing/branch-visibility.mock';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ExpensesService, RequestUser } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Expense } from './entities/expense.entity';

describe('ExpensesService (Step 1 Controls)', () => {
    let service: ExpensesService;
    let mockExpenseRepo: any;
    let mockOrgUserRepo: any;
    let mockNotificationsService: any;

    const managerUser: RequestUser = {
        userId: 'manager-1',
        organisationId: 'org-1',
        role: 'MANAGER',
    };

    const otherUser: RequestUser = {
        userId: 'staff-2',
        organisationId: 'org-1',
        role: 'STAFF',
    };

    const makeExpense = (overrides: Partial<Expense> = {}): Expense => {
        return {
            id: 'exp-1',
            organisationId: 'org-1',
            amount: 1000,
            category: 'supplies',
            description: 'Paper and pens',
            expenseDate: new Date('2026-09-23'),
            receiptUrl: null,
            status: 'pending',
            flagReason: null,
            incurredBy: 'staff-2',
            createdBy: 'staff-2',
            approvedBy: null,
            approvedAt: null,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides,
        } as Expense;
    };

    beforeEach(() => {
        mockExpenseRepo = {
            create: jest.fn((dto) => ({ ...dto, id: 'exp-new' })),
            save: jest.fn((entity) => Promise.resolve({ ...entity })),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
        };

        mockOrgUserRepo = {
            find: jest.fn(() => Promise.resolve([])),
        };

        mockNotificationsService = {
            sendToUsers: jest.fn(() => Promise.resolve()),
        };

        service = new ExpensesService(
            mockExpenseRepo,
            mockOrgUserRepo,
            mockNotificationsService,
            unrestrictedBranchVisibilityMock(),
        );
    });

    describe('Creation', () => {
        it('normal create sets status to pending and records submitter', async () => {
            const dto: CreateExpenseDto = {
                amount: 500,
                category: 'food',
                description: 'Lunch meeting',
                date: '2026-09-23',
            };

            const result = await service.create(dto, managerUser);

            expect(mockExpenseRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'pending',
                    incurredBy: managerUser.userId,
                    createdBy: managerUser.userId,
                    amount: 500,
                }),
            );
            expect(result.status).toBe('pending');
        });

        it('DTO rejects client-supplied status=verified under forbidNonWhitelisted', async () => {
            const rawBody = {
                amount: 500,
                category: 'food',
                description: 'Lunch meeting',
                date: '2026-09-23',
                status: 'verified',
            };

            const dtoInstance = plainToInstance(CreateExpenseDto, rawBody);
            const errors = await validate(dtoInstance, {
                whitelist: true,
                forbidNonWhitelisted: true,
            });

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((e) => e.property === 'status')).toBe(true);
        });

        it('service create forces pending even if a status property is present on input', async () => {
            const dtoWithSneakyStatus = {
                amount: 500,
                category: 'food',
                description: 'Lunch meeting',
                date: '2026-09-23',
                status: 'verified',
            } as any;

            await service.create(dtoWithSneakyStatus, managerUser);

            expect(mockExpenseRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'pending',
                }),
            );
        });
    });

    describe('Segregation of duties & Self-Verification', () => {
        it('allows a manager to verify someone else pending expense', async () => {
            const expense = makeExpense({ status: 'pending', incurredBy: 'other-user', createdBy: 'other-user' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            const result = await service.update(expense.id, { status: 'verified' }, managerUser);

            expect(result.status).toBe('verified');
            expect(mockExpenseRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'verified',
                    approvedBy: managerUser.userId,
                }),
            );
        });

        it('rejects manager verifying their own pending expense with 403', async () => {
            const expense = makeExpense({ status: 'pending', incurredBy: managerUser.userId, createdBy: managerUser.userId });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.update(expense.id, { status: 'verified' }, managerUser),
            ).rejects.toThrow(ForbiddenException);
        });

        it('rejects manager verifying their own flagged expense with 403', async () => {
            const expense = makeExpense({ status: 'flagged', incurredBy: managerUser.userId, createdBy: managerUser.userId });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.update(expense.id, { status: 'verified' }, managerUser),
            ).rejects.toThrow(ForbiddenException);
        });

        it('403 forbidden message does NOT contain deactivat, account, or revoked', async () => {
            const expense = makeExpense({ status: 'pending', incurredBy: managerUser.userId, createdBy: managerUser.userId });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            try {
                await service.update(expense.id, { status: 'verified' }, managerUser);
                fail('Expected ForbiddenException');
            } catch (err: any) {
                expect(err).toBeInstanceOf(ForbiddenException);
                expect(/deactivat|account|revoked/i.test(err.message)).toBe(false);
            }
        });
    });

    describe('Status Transitions & Edits', () => {
        it('pending -> edit is allowed', async () => {
            const expense = makeExpense({ status: 'pending' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await service.update(expense.id, { amount: 2000, description: 'Updated desc' }, managerUser);

            expect(mockExpenseRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: 2000,
                    description: 'Updated desc',
                }),
            );
        });

        it('pending -> flag is allowed with reason', async () => {
            const expense = makeExpense({ status: 'pending' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            const result = await service.update(
                expense.id,
                { status: 'flagged', flagReason: 'Missing receipt' },
                managerUser,
            );

            expect(result.status).toBe('flagged');
            expect(mockExpenseRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'flagged',
                    flagReason: 'Missing receipt',
                }),
            );
        });

        it('flagged -> verify is allowed for manager (Mark as Verified)', async () => {
            const expense = makeExpense({ status: 'flagged', incurredBy: 'someone-else' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            const result = await service.update(expense.id, { status: 'verified' }, managerUser);

            expect(result.status).toBe('verified');
            expect(mockExpenseRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'verified',
                    approvedBy: managerUser.userId,
                    flagReason: null,
                }),
            );
        });

        it('flagged -> edit is rejected with 400', async () => {
            const expense = makeExpense({ status: 'flagged' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.update(expense.id, { amount: 1500 }, managerUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('flagged -> pending is rejected with 400', async () => {
            const expense = makeExpense({ status: 'flagged' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.update(expense.id, { status: 'pending' }, managerUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('verified -> edit amount/category is rejected with 400', async () => {
            const expense = makeExpense({ status: 'verified' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.update(expense.id, { amount: 5000 }, managerUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('verified -> flag is rejected with 400 (verified is terminal)', async () => {
            const expense = makeExpense({ status: 'verified' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.update(expense.id, { status: 'flagged' }, managerUser),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('Deletion', () => {
        it('pending -> delete is allowed', async () => {
            const expense = makeExpense({ status: 'pending' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            const result = await service.remove(expense.id, managerUser);

            expect(result.message).toBe('Expense deleted successfully');
            expect(mockExpenseRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    deletedAt: expect.any(Date),
                }),
            );
        });

        it('flagged -> delete is rejected with 400', async () => {
            const expense = makeExpense({ status: 'flagged' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(service.remove(expense.id, managerUser)).rejects.toThrow(BadRequestException);
        });

        it('verified -> delete is rejected with 400', async () => {
            const expense = makeExpense({ status: 'verified' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(service.remove(expense.id, managerUser)).rejects.toThrow(BadRequestException);
        });
    });

    describe('Role Authorization', () => {
        it('non-manager cannot update/verify/flag expenses (403)', async () => {
            const expense = makeExpense({ status: 'pending' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.update(expense.id, { status: 'verified' }, otherUser),
            ).rejects.toThrow(ForbiddenException);
        });

        it('non-manager cannot delete expenses (403)', async () => {
            const expense = makeExpense({ status: 'pending' });
            mockExpenseRepo.findOne.mockResolvedValue({ ...expense });

            await expect(
                service.remove(expense.id, otherUser),
            ).rejects.toThrow(ForbiddenException);
        });

        it('non-manager 403 messages do not contain deactivat, account, or revoked', async () => {
            const logoutWords = /deactivat|account|revoked/i;
            const updateErr = await service.update('exp-1', { status: 'verified' }, otherUser).catch((e) => e);
            const removeErr = await service.remove('exp-1', otherUser).catch((e) => e);

            expect(updateErr).toBeInstanceOf(ForbiddenException);
            expect(removeErr).toBeInstanceOf(ForbiddenException);
            expect(logoutWords.test(updateErr.message)).toBe(false);
            expect(logoutWords.test(removeErr.message)).toBe(false);
        });
    });
});
